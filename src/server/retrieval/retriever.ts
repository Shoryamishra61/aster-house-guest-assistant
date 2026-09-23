import { KnowledgeItem } from "../data/hotelData";
import { defaultKnowledgeGovernance } from "../domain/knowledgeGovernance";

export type RetrievalResult = {
  item: KnowledgeItem;
  score: number;
};

/**
 * Normalizes text for lexical comparison.
 */
const STOP_WORDS = new Set([
  "do", "you", "the", "a", "an", "in", "on", "at", "of", "for", "to", "is", "are",
  "and", "or", "it", "this", "that", "with", "have", "offer", "can", "i", "we", "our"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Deterministic lexical scoring across title, aliases, facts, and summary.
 */
export function retrieveKnowledge(query: string, limit: number = 3): RetrievalResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: RetrievalResult[] = [];
  const activeItems = defaultKnowledgeGovernance.getActiveItems();

  for (const item of activeItems) {
    let score = 0;
    const itemTokens = new Set<string>();

    tokenize(item.title).forEach((t) => itemTokens.add(t));
    item.aliases.forEach((a) => tokenize(a).forEach((t) => itemTokens.add(t)));
    tokenize(item.summary).forEach((t) => itemTokens.add(t));

    for (const [key, val] of Object.entries(item.facts)) {
      tokenize(key).forEach((t) => itemTokens.add(t));
      if (typeof val === "string") {
        tokenize(val).forEach((t) => itemTokens.add(t));
      } else if (Array.isArray(val)) {
        val.forEach((v) => tokenize(String(v)).forEach((t) => itemTokens.add(t)));
      }
    }

    // Direct alias phrase match boost
    const lowerQuery = query.toLowerCase();
    for (const alias of item.aliases) {
      if (lowerQuery.includes(alias.toLowerCase())) {
        score += 8;
      }
    }

    if (lowerQuery.includes(item.title.toLowerCase())) {
      score += 10;
    }

    // Token intersection score on meaningful terms
    for (const token of queryTokens) {
      if (itemTokens.has(token)) {
        score += 3;
      }
    }

    // Threshold of 6 requires either an alias match, a title match, or multiple informative keyword hits
    if (score >= 6) {
      results.push({ item, score });
    }
  }

  // Sort descending by score, deterministic tie-break by item ID
  results.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));

  return results.slice(0, limit);
}
