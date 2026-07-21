"use server";

import { analyzeMenuImage } from "@/lib/gemini";
import { validateGeminiResponse } from "@/lib/validators";
import { getCurrentUser } from "./auth";
import type { MenuScanResponse } from "@/types/menu-import";

const MAX_SIZE = 10 * 1024 * 1024;

export async function scanMenuImage(
  base64Data: string,
  mimeType: string
): Promise<MenuScanResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!["image/png", "image/jpeg", "image/jpg"].includes(mimeType)) {
    return { success: false, error: "Invalid file type. Please upload a PNG, JPG, or JPEG image." };
  }

  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
  if (sizeInBytes > MAX_SIZE) {
    return { success: false, error: "File too large. Maximum size is 10MB." };
  }

  try {
    const rawResponse = await analyzeMenuImage(base64Data, mimeType);
    const validation = validateGeminiResponse(rawResponse);

    if (!validation.valid) {
      return { success: false, error: validation.error! };
    }

    return { success: true, items: validation.data!.items };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    const msg = raw.toLowerCase();
    console.error("[menu-scanner] Error:", raw);

    if (msg.includes("api key") || msg.includes("apikey") || msg.includes("invalid_key") || msg.includes("401") || msg.includes("403")) {
      return { success: false, error: "AI service authentication failed. Check your GEMINI_API_KEY." };
    }
    if (msg.includes("timeout") || msg.includes("deadline")) {
      return { success: false, error: "AI service timed out. Please try again." };
    }
    if (msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("quota")) {
      return { success: false, error: "AI service rate limit exceeded. Please try again later." };
    }
    if (msg.includes("not found") || msg.includes("404") || msg.includes("does not exist")) {
      return { success: false, error: `AI model not available. Detail: ${raw}` };
    }

    return { success: false, error: `Failed to analyze menu: ${raw}` };
  }
}
