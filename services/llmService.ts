import { GoogleGenAI } from "@google/genai";           // ✅ updated
import OpenAI from "openai";
import { Mistral } from "@mistralai/mistralai";        // ✅ updated
import { LLMModelType } from "../types";
import { AVAILABLE_MODELS } from "../constants";
import * as config from "../env.js";                   // keep if you’re using env.js

// ────────────────────────────────────────────────────────────────────────────
// Cache clients
// ────────────────────────────────────────────────────────────────────────────
let geminiAi: GoogleGenAI | null = null;
let openaiAi: OpenAI | null = null;
let mistralAi: Mistral   | null = null;

// ────────────────────────────────────────────────────────────────────────────
// Initializers
// ────────────────────────────────────────────────────────────────────────────
const initializeGemini = () => {
  if (geminiAi) return;
  const apiKey = config.API_KEY;
  if (!apiKey || apiKey === "YOUR_GOOGLE_GEMINI_API_KEY_HERE") {
    throw new Error("GEMINI_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  geminiAi = new GoogleGenAI({ apiKey });
};

const initializeOpenAI = () => {
  if (openaiAi) return;
  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY_HERE") {
    throw new Error("OPENAI_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  openaiAi = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};

const initializeMistral = () => {
  if (mistralAi) return;
  const apiKey = config.MISTRAL_API_KEY;
  if (!apiKey || apiKey === "YOUR_MISTRAL_API_KEY_HERE") {
    throw new Error("MISTRAL_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  mistralAi = new Mistral({ apiKey });
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const getModelProvider = (modelId: LLMModelType) => {
  const def = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!def) throw new Error(`Model ID ${modelId} not found.`);
  return def.provider; // 'gemini' | 'openai' | 'mistral'
};

// ────────────────────────────────────────────────────────────────────────────
// Main LLM generation
// ────────────────────────────────────────────────────────────────────────────
export const generateLlmResponse = async (
  prompt: string,
  modelId: LLMModelType,
  providerConfig?: any,
): Promise<string> => {
  if (!prompt.trim()) return "";

  const provider = getModelProvider(modelId);
  const actualModelId = modelId.split("/")[1]; // part after provider/

  try {
    if (provider === "gemini") {
      initializeGemini();
      const response = await geminiAi!.models.generateContent({
        model: actualModelId,
        contents: prompt,
        ...(providerConfig && { config: providerConfig }),
      });
      return response.text?.trim() ||
        `No text received (finish reason: ${response.candidates?.[0]?.finishReason ?? "N/A"}).`;

    } else if (provider === "openai") {
      initializeOpenAI();
      const messages: any[] = [];
      if (providerConfig?.systemInstruction) {
        messages.push({ role: "system", content: providerConfig.systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const resp = await openaiAi!.chat.completions.create({
        model: actualModelId,
        messages,
      });
      return resp.choices[0]?.message?.content?.trim() ||
        `No text received (finish reason: ${resp.choices[0]?.finish_reason ?? "N/A"}).`;

    } else if (provider === "mistral") {
      initializeMistral();
      const messages: any[] = [];
      if (providerConfig?.systemInstruction) {
        messages.push({ role: "system", content: providerConfig.systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const resp = await mistralAi!.chat.complete({
        model: actualModelId,
        messages,
      });
      return resp.choices[0]?.message?.content?.trim() ||
        `No text received (finish reason: ${resp.choices[0]?.finish_reason ?? "N/A"}).`;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (err: any) {
    // centralised error handling
    const base = `Failed to get response from ${provider}: `;
    throw new Error(base + (err?.message || String(err)));
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Translation helper (Gemini)
// ────────────────────────────────────────────────────────────────────────────
export const translateText = async (
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> => {
  if (!text.trim() || !sourceLang || !targetLang || sourceLang === targetLang) return text;

  initializeGemini();

  const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. ` +
                 `Return ONLY the translated text.\n\nText: "${text}"`;

  const response = await geminiAi!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { temperature: 0 },
  });

  const translated = response.text?.trim();
  if (!translated) {
    const reason = response.candidates?.[0]?.finishReason ?? "N/A";
    throw new Error(`Translation failed (finish reason: ${reason}).`);
  }
  return translated.replace(/^"|"$/g, "");
};
