import { GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_INSTRUCTION = `You are an expert restaurant menu parser.

Extract every menu item visible in the image.

For each item determine:
- name
- description
- price
- food type (VEG, NON_VEG, or VEGAN)
- spicy level (0 to 3)
- ingredients (only visible/implied ingredients)
- allergens (only if explicitly indicated)

Rules:
- Ignore decorative text.
- Ignore restaurant address.
- Ignore phone numbers.
- Ignore GST.
- Ignore QR codes.
- Ignore page headers.
- Ignore page footers.
- Ignore combo titles unless they represent actual menu items.
- Preserve item names exactly as written.
- Prices must be numeric (no currency symbols).
- If price is unavailable use 0.
- If food type cannot be determined use VEG.
- If spicy level is unknown use 0.
- Ingredients should only include visible ingredients.
- Never hallucinate ingredients.
- Never invent allergens.

Return only valid JSON in the exact schema provided. No markdown. No explanations.`;

const JSON_SCHEMA_INSTRUCTION = `Respond with a JSON object matching this exact schema:
{
  "items": [
    {
      "name": "string",
      "description": "string",
      "price": 0,
      "foodType": "VEG" | "NON_VEG" | "VEGAN",
      "spicyLevel": 0,
      "ingredients": ["string"],
      "allergens": ["string"]
    }
  ]
}`;

async function callGemini(
  base64Data: string,
  mimeType: string,
  model: string
): Promise<unknown> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this restaurant menu image and extract all menu items. ${JSON_SCHEMA_INSTRUCTION}`,
          },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI model.");
  }

  return JSON.parse(text);
}

export async function analyzeMenuImage(
  base64Data: string,
  mimeType: string
): Promise<unknown> {
  try {
    return await callGemini(base64Data, mimeType, PRIMARY_MODEL);
  } catch (primaryError) {
    console.warn("Primary model failed, trying fallback:", primaryError);
    return await callGemini(base64Data, mimeType, FALLBACK_MODEL);
  }
}
