"use server";

import { GoogleGenAI } from "@google/genai";
import { getStorageClient, getPublicUrl } from "@/lib/supabase/storage";
import { getCurrentUser } from "./auth";
import { revalidatePath } from "next/cache";

const IMAGE_SEARCH_MODEL = "gemini-3.5-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findImageForDish(dishName: string): Promise<string | null> {
  const ai = getClient();
  
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_SEARCH_MODEL,
      contents: `Find a single high-quality, appetizing food photo URL for "${dishName}". Return ONLY the direct image URL (starting with http), nothing else.`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) return null;

    // Extract URL from response - look for http/https URLs
    const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(jpg|jpeg|png|webp)/i);
    if (urlMatch) {
      return urlMatch[0];
    }

    // Try to find any URL
    const anyUrlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/);
    if (anyUrlMatch) {
      return anyUrlMatch[0];
    }

    return null;
  } catch (error) {
    console.error(`[image-search] Failed for "${dishName}":`, error);
    return null;
  }
}

async function downloadAndUploadImage(
  imageUrl: string,
  dishName: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MenuApp/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[image-download] Failed to download: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      console.error(`[image-download] Not an image: ${contentType}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    
    // Validate size (max 5MB)
    if (buffer.byteLength > 5 * 1024 * 1024) {
      console.error(`[image-download] Image too large: ${buffer.byteLength} bytes`);
      return null;
    }

    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const safeName = dishName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const storagePath = `menu-items/${userId}/${safeName}-${Date.now()}.${ext}`;

    const storageClient = getStorageClient();
    const { error: uploadError } = await storageClient.storage
      .from("menu-images")
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`[image-upload] Failed:`, uploadError.message);
      return null;
    }

    return getPublicUrl(storagePath);
  } catch (error) {
    console.error(`[image-download] Error:`, error);
    return null;
  }
}

export interface GenerateImagesResult {
  success: true;
  results: { dishName: string; imageUrl: string | null }[];
}

export interface GenerateImagesError {
  success: false;
  error: string;
}

export type GenerateImagesResponse = GenerateImagesResult | GenerateImagesError;

export async function generateMenuImages(
  dishNames: string[]
): Promise<GenerateImagesResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!dishNames || dishNames.length === 0) {
    return { success: false, error: "No dish names provided." };
  }

  // Limit to 20 items per batch to avoid rate limits
  const itemsToProcess = dishNames.slice(0, 20);
  const results: { dishName: string; imageUrl: string | null }[] = [];

  // Process in batches of 5 with delay between batches
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 1500;

  for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
    const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (dishName) => {
        const imageUrl = await findImageForDish(dishName);
        if (!imageUrl) {
          return { dishName, imageUrl: null };
        }

        const storedUrl = await downloadAndUploadImage(imageUrl, dishName, user.id);
        return { dishName, imageUrl: storedUrl };
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ dishName: "unknown", imageUrl: null });
      }
    }

    // Delay between batches (except for the last batch)
    if (i + BATCH_SIZE < itemsToProcess.length) {
      await sleep(BATCH_DELAY);
    }
  }

  revalidatePath("/dashboard/menu");
  
  return { success: true, results };
}
