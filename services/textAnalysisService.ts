import { ExtractedEntities } from '../types';

// Helper function to convert Eastern Arabic numerals (used in Persian, Urdu, etc.) 
// to Western Arabic numerals (0-9) for consistent processing.
const normalizeDigits = (text: string): string => {
  const easternArabicNumerals: { [key: string]: string } = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return text.replace(/[۰-۹]/g, (char) => easternArabicNumerals[char]);
};


// Regex for URLs (improved to be more inclusive of domains without http/www prefixes)
const URL_REGEX = /\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/gi;

// Regex for Email Addresses (common pattern)
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;

// Regex for Phone Numbers (more comprehensive, tries to catch various international formats, requires at least 7 digits to reduce false positives)
// Runs on text with normalized digits.
const PHONE_REGEX = /(?:\+?\d{1,4}[\s.-]?)?(?:\(\d{1,5}\)[\s.-]?)?[\d\s.-]{7,}\d/g;


/**
 * Extracts potential physical addresses from text using heuristic-based regexes for both
 * English and Farsi/Dari address patterns.
 * @param text The source text to analyze (should not be digit-normalized for Farsi patterns).
 * @returns An array of unique potential address strings.
 */
const extractPhysicalAddresses = (text: string): string[] => {
    // Pattern for typical English-style addresses (number first) and P.O. boxes.
    const englishAddressRegex = /\b(\d{1,5}\s+([A-Za-z0-9\s.,'#-]+?)\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Circle|Cir)|P\.?O\.?\s+Box\s+\d+)\b/gi;
    
    // Pattern for Farsi/Dari-style addresses, looking for common keywords.
    // This is a broad heuristic. It matches keywords and the text that follows.
    const farsiAddressRegex = /(?:آدرس|خیابان|کوچه|بلوار|میدان|پلاک)\s*[:\s]*[A-Za-z\u0600-\u06FF\s\d۰-۹,.-]+/g;

    const englishMatches = text.match(englishAddressRegex) || [];
    const farsiMatches = text.match(farsiAddressRegex) || [];
    
    const allMatches = [...englishMatches, ...farsiMatches];

    if (allMatches.length === 0) {
        return [];
    }
    // Use a Set to get unique addresses and clean them up
    return [...new Set(allMatches.map(m => m.trim().replace(/,$/, '')))];
};


export const analyzeTextResponse = (text: string): ExtractedEntities => {
  if (!text || !text.trim()) {
    return {
      mentioned_links_list: [],
      mentioned_links_count: 0,
      mentioned_emails_list: [],
      mentioned_emails_count: 0,
      mentioned_phones_list: [],
      mentioned_phones_count: 0,
      physical_addresses_list: [],
      physical_addresses_count: 0,
      mentioned_references_list: [], // This is now manual, so we return an empty list.
      mentioned_references_count: 0,
    };
  }
  
  // Normalize digits for phone number detection
  const normalizedText = normalizeDigits(text);

  const mentioned_links_list = Array.from(text.matchAll(URL_REGEX)).map(match => match[0]);
  const mentioned_emails_list = Array.from(text.matchAll(EMAIL_REGEX)).map(match => match[0]);
  
  // Use normalized text for phone numbers
  const raw_phones = Array.from(normalizedText.matchAll(PHONE_REGEX)).map(match => match[0]);
  // Post-filter phone numbers to avoid overly short/simple numbers like '2024'
  const mentioned_phones_list = raw_phones.filter(phone => phone.replace(/\D/g, '').length >= 7);

  // Use original text for addresses to preserve Farsi characters and context
  const physical_addresses_list = extractPhysicalAddresses(text);
  
  return {
    mentioned_links_list,
    mentioned_links_count: mentioned_links_list.length,
    mentioned_emails_list,
    mentioned_emails_count: mentioned_emails_list.length,
    mentioned_phones_list,
    mentioned_phones_count: mentioned_phones_list.length,
    physical_addresses_list,
    physical_addresses_count: physical_addresses_list.length,
    mentioned_references_list: [], // Explicitly return empty array for manual entry
    mentioned_references_count: 0,
  };
};
