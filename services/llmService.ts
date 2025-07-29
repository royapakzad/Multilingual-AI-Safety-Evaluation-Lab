


import { GoogleGenAI, GenerateContentResponse, FinishReason } from "@google/genai";
import OpenAI from "openai";
import MistralAI from "@mistralai/mistralai";
import { LLMModelType } from '../types';
import { AVAILABLE_MODELS } from '../constants';
import * as config from '../env.js'; // Import API keys from env.js

// Caching initialized clients to avoid re-creation on every call
let geminiAi: GoogleGenAI | null = null;
let openaiAi: OpenAI | null = null;
let mistralAi: MistralAI | null = null;

/**
 * Initializes the Google Gemini client if not already initialized.
 * @throws {Error} if the API key is missing or a placeholder.
 */
const initializeGemini = () => {
  if (geminiAi) return;
  const apiKey = config.API_KEY;
  if (!apiKey || (apiKey as string) === "YOUR_GOOGLE_GEMINI_API_KEY_HERE") {
    console.error("Gemini API key is not defined or is a placeholder.");
    throw new Error("GEMINI_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  geminiAi = new GoogleGenAI({ apiKey });
  console.log("Gemini AI client initialized.");
};

/**
 * Initializes the OpenAI client if not already initialized.
 * @throws {Error} if the API key is missing or a placeholder.
 */
const initializeOpenAI = () => {
  if (openaiAi) return;
  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey || (apiKey as string) === "YOUR_OPENAI_API_KEY_HERE") {
    console.error("OpenAI API key is not defined or is a placeholder.");
    throw new Error("OPENAI_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  openaiAi = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  console.log("OpenAI client initialized.");
};

/**
 * Initializes the Mistral client if not already initialized.
 * @throws {Error} if the API key is missing or a placeholder.
 */
const initializeMistral = () => {
  if (mistralAi) return;
  const apiKey = config.MISTRAL_API_KEY;
  if (!apiKey || (apiKey as string) === "YOUR_MISTRAL_API_KEY_HERE") {
    console.error("Mistral API key is not defined or is a placeholder.");
    throw new Error("MISTRAL_API_KEY_MISSING_OR_PLACEHOLDER");
  }
  mistralAi = new MistralAI(apiKey);
  console.log("Mistral AI client initialized.");
};

/**
 * Gets the provider ('gemini', 'openai', 'mistral') for a given model ID.
 * @param modelId The full model ID (e.g., 'gemini/gemini-2.5-flash').
 * @returns The provider name.
 * @throws {Error} if the model ID is not found.
 */
const getModelProvider = (modelId: LLMModelType) => {
    const modelDefinition = AVAILABLE_MODELS.find(m => m.id === modelId);
    if (!modelDefinition) {
        throw new Error(`Model ID ${modelId} not found in AVAILABLE_MODELS.`);
    }
    return modelDefinition.provider;
};

/**
 * Generates a response from the specified LLM.
 * @param prompt The user prompt.
 * @param modelId The model to use.
 * @param providerConfig Optional provider-specific configuration.
 * @returns The LLM's text response as a string.
 */
export const generateLlmResponse = async (prompt: string, modelId: LLMModelType, providerConfig?: any): Promise<string> => {
  if (!prompt.trim()) {
    console.warn("Empty prompt provided to generateLlmResponse.");
    return ""; 
  }

  const provider = getModelProvider(modelId);
  const actualModelId = modelId.substring(modelId.indexOf('/') + 1);

  try {
    if (provider === 'gemini') {
      initializeGemini();
      if (!geminiAi) throw new Error("Gemini AI client not initialized.");
      const response: GenerateContentResponse = await geminiAi.models.generateContent({ 
          model: actualModelId, 
          contents: prompt,
          ...(providerConfig && { config: providerConfig })
      });
      const text = response.text;
      if (text) return text;

      const finishReason = response.candidates?.[0]?.finishReason;
      const message = `No text content received from Gemini. Finish reason: ${finishReason || 'N/A'}.`;
      console.warn(message, { response });
      return message;

    } else if (provider === 'openai') {
      initializeOpenAI();
      if (!openaiAi) throw new Error("OpenAI client not initialized.");
      
      const messages: any[] = [];
      if (providerConfig?.systemInstruction) {
          messages.push({ role: "system", content: providerConfig.systemInstruction });
      }
      messages.push({ role: "user", content: prompt });
      
      const response = await openaiAi.chat.completions.create({ model: actualModelId, messages });
      return response.choices[0]?.message?.content?.trim() || `No text content received from OpenAI. Finish reason: ${response.choices[0]?.finish_reason || 'N/A'}.`;

    } else if (provider === 'mistral') {
      initializeMistral();
      if (!mistralAi) throw new Error("Mistral AI client not initialized.");

      const messages: any[] = [];
      if (providerConfig?.systemInstruction) {
          messages.push({ role: "system", content: providerConfig.systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await mistralAi.chat({ model: actualModelId, messages });
      return response.choices[0]?.message?.content?.trim() || `No text content received from Mistral. Finish reason: ${response.choices[0]?.finish_reason || 'N/A'}.`;
    
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error with provider ${provider}:`, error);
    let errorMessage = `Failed to get response from ${provider}.`;
    if (error instanceof Error) {
        if (error.message.includes("_API_KEY_MISSING_OR_PLACEHOLDER")) {
            errorMessage = `API key for ${provider} is missing or is a placeholder in env.js.`;
        } else if ((error as any).status === 401 || error.message?.toLowerCase().includes('api key')) {
            errorMessage = `API key for ${provider} is not valid. Please check it. Original error: ${error.message}`;
        } else if ((error as any).status === 429) {
            errorMessage = `${provider} API Error (429): Rate limit or quota exceeded. Please check your account plan and usage.`;
        } else {
            errorMessage = `An unexpected error occurred with ${provider}: ${error.message}`;
        }
    } else {
        errorMessage = `An unknown error occurred with ${provider}: ${String(error)}`;
    }
    throw new Error(errorMessage);
  }
};

/**
 * Translates text from a source language to a target language using the Gemini API.
 * @param text The text to translate.
 * @param sourceLang The source language name or code.
 * @param targetLang The target language name or code.
 * @returns The translated text as a string.
 */
export const translateText = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
  if (!text.trim() || !sourceLang || !targetLang || sourceLang === targetLang) {
    return text;
  }
  try {
    initializeGemini();
    if (!geminiAi) throw new Error("Gemini AI client not initialized for translation.");
    
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translated text, without any introductory phrases, explanations, or quotation marks.\n\nText to translate: "${text}"`;
    
    const response = await geminiAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0, // Lower temperature for more deterministic, accurate translations
        }
    });

    const translatedText = response.text?.trim();

    if (translatedText) {
      // Models sometimes wrap the translation in quotes, let's remove them.
      return translatedText.replace(/^"|"$/g, '');
    }
    
    const finishReason = response.candidates?.[0]?.finishReason;
    const message = `Translation failed. Gemini did not produce text. Finish reason: ${finishReason || 'N/A'}.`;
    console.error(message, { response });
    throw new Error(message);

  } catch (error) {
    console.error(`Error translating from ${sourceLang} to ${targetLang} with Gemini:`, error);
    let finalErrorMessage: string;

    if (error instanceof Error) {
        if (error.message.includes("GEMINI_API_KEY_MISSING_OR_PLACEHOLDER")) {
            finalErrorMessage = `Translation service unavailable: Gemini API key is missing or is a placeholder in env.js.`;
        } else if ((error as any).status === 401 || error.message?.toLowerCase().includes('api key')) {
            finalErrorMessage = `Translation service unavailable: Gemini API key is not valid. Please check it. Original error: ${error.message}`;
        } else if ((error as any).status === 429) {
            const errorDetails = (error as any).error?.message || error.message;
            finalErrorMessage = `Gemini API Error (429): Rate limit or quota exceeded. ${errorDetails}`;
        } else {
            finalErrorMessage = `An unexpected error occurred during translation with Gemini: ${error.message}`;
        }
    } else {
        finalErrorMessage = `An unknown error occurred during translation: ${String(error)}`;
    }
    
    throw new Error(finalErrorMessage);
  }
};