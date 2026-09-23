import { ConversationLanguage } from "./contracts";

/**
 * Aster House - Multilingual Message Normalizer & Language Detector
 * Normalizes common typos, hotel shorthand, contractions, colloquialisms,
 * and Romanized Hindi/Hinglish terms without destroying the original user message text.
 */

export type NormalizedMessage = {
  original: string;
  normalized: string;
  tokens: string[];
  detectedLanguage: ConversationLanguage;
  hasNegation: boolean;
};

const TYPO_MAP: Record<string, string> = {
  // check in / check out
  wat: "what",
  tym: "time",
  chck: "check",
  chekin: "check in",
  checkin: "check in",
  chekout: "check out",
  checkout: "check out",
  chek: "check",
  // breakfast / meals
  breakfst: "breakfast",
  brkfast: "breakfast",
  bfast: "breakfast",
  inclded: "included",
  incld: "included",
  incl: "included",
  // room / stay
  rom: "room",
  rms: "rooms",
  ppl: "people",
  pers: "people",
  person: "people",
  persons: "people",
  adult: "adults",
  adlt: "adults",
  adlts: "adults",
  nite: "night",
  nites: "nights",
  // availability
  avail: "available",
  availabl: "available",
  avaialble: "available",
  availabilty: "availability",
  nxt: "next",
  wknd: "weekend",
  // amenities
  u: "you",
  hv: "have",
  wif: "wifi",
  wiffi: "wifi",
  valey: "valet",
  swimmin: "swimming",
  swim: "swimming pool",
  // cancellation / policy
  cncl: "cancel",
  cnclation: "cancellation",
  cancle: "cancel",
  canceling: "cancelling",
};

/**
 * Common Hinglish grammar and vocabulary tokens
 */
const HINGLISH_TOKENS = new Set([
  "hai",
  "hain",
  "kya",
  "kitne",
  "kitna",
  "baje",
  "chahiye",
  "kaunsa",
  "kaun",
  "sasta",
  "sabse",
  "bada",
  "chota",
  "band",
  "hota",
  "hoti",
  "hote",
  "kab",
  "kaha",
  "kahan",
  "hum",
  "hamare",
  "log",
  "logon",
  "ke",
  "liye",
  "nahi",
  "mat",
  "dusra",
  "pehla",
  "wali",
  "wala",
  "wale",
  "raat",
  "din",
  "kal",
  "parso",
  "agle",
  "paas",
  "baare",
  "mein",
  "se",
  "tak",
  "batao",
  "boliye",
  "bataiye",
  "karo",
  "karna",
  "milega",
  "milta",
  "milti",
  "sakta",
  "sakti",
  "sakte",
  "meri",
  "mera",
  "mere",
  "dikhao",
  "pichle",
  "inme",
]);

/**
 * Detects whether the input is Hindi (Devanagari), Hinglish (Romanized Hindi-English),
 * or English, taking previous conversation language into account for brief follow-ups.
 */
export function detectLanguage(
  text: string,
  priorLanguage?: ConversationLanguage
): ConversationLanguage {
  if (!text || !text.trim()) return priorLanguage || "en";

  // 1. Devanagari Unicode Block: \u0900 - \u097F
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) {
    return "hi";
  }

  // 2. Tokenize lowercase words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let hinglishCount = 0;
  for (const w of words) {
    if (HINGLISH_TOKENS.has(w)) {
      hinglishCount++;
    }
  }

  // If at least one distinct Hinglish function word is present (e.g. "hai", "kya", "chahiye", "kab")
  if (hinglishCount >= 1) {
    return "hi-en";
  }

  // Brief elliptical follow-ups like "timing?", "and checkout?", "dinner?" inherit prior language
  if (words.length <= 2 && priorLanguage && priorLanguage !== "en" && priorLanguage !== "unknown") {
    // If words are purely neutral English tokens like "timing", "dinner", "second room"
    return priorLanguage;
  }

  return "en";
}

export function normalizeUserMessage(
  raw: string,
  priorLanguage?: ConversationLanguage
): NormalizedMessage {
  const original = raw || "";
  let text = original.toLowerCase().trim();

  // Normalize smart quotes & unicode apostrophes
  text = text.replace(/[\u2018\u2019]/g, "'");
  text = text.replace(/[\u201C\u201D]/g, '"');

  // Strip leading/trailing quotation marks that guests often copy-paste
  text = text.replace(/^["']+|["']+$/g, "").trim();

  // Detect language before aggressive English contraction expansion
  const detectedLanguage = detectLanguage(original, priorLanguage);

  // Check for explicit negation
  const hasNegation = /\b(not|no|don't|do not|nahi|nahin|mat|without)\b/i.test(text);

  // Expand contractions
  text = text
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bwhere's\b/g, "where is")
    .replace(/\bhow's\b/g, "how is")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bwe're\b/g, "we are")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bi've\b/g, "i have");

  // Normalize hotel colloquialisms
  text = text
    .replace(/\bcrash in one room\b/g, "crash in one room")
    .replace(/\bme \+ 2 mates\b/g, "3 people")
    .replace(/\bme and my wife\b/g, "2 adults")
    .replace(/\bmy wife and i\b/g, "2 adults")
    .replace(/\btwo of us\b/g, "2 adults")
    .replace(/\bfree or nah\b/g, "free or not")
    .replace(/\byo\b/g, "")
    .replace(/\bactually make that\b/g, "change dates to")
    .replace(/\bsorry i meant\b/g, "change dates to");

  // Token replacement for known typos
  const words = text.split(/\s+/).map((w) => {
    const clean = w.replace(/[^a-z0-9\u0900-\u097F]/g, "");
    if (TYPO_MAP[clean]) {
      return TYPO_MAP[clean];
    }
    return w;
  });

  const normalized = words.join(" ").replace(/\s+/g, " ").trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return {
    original,
    normalized,
    tokens,
    detectedLanguage,
    hasNegation,
  };
}
