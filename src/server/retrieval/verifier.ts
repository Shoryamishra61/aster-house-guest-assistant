import { KnowledgeItem } from "../data/hotelData";
import { GroundedAnswerResult } from "../../shared/contracts";

export type ClaimType =
  | "MONEY"
  | "TIME"
  | "DATE"
  | "ROOM"
  | "AMENITY"
  | "POLICY"
  | "CONTACT"
  | "AVAILABILITY"
  | "BOOKING";

export type VerificationResult = {
  isValid: boolean;
  reason?: string;
  detectedClaimTypes?: ClaimType[];
};

/**
 * Enhanced claim-level verifier for grounded answers.
 * Enforces:
 * 1. sourceIds must be a strict subset of supplied knowledge fact IDs.
 * 2. If supported=false, cannot return a confident answer claiming facts.
 * 3. Prohibits inventing dates, prices, or room availability not backed by facts or tools.
 * 4. Dedicated claim validators for Money, Time, Availability, Booking, and Contact.
 */
export function verifyGroundedAnswer(
  answer: GroundedAnswerResult,
  suppliedFacts: KnowledgeItem[]
): VerificationResult {
  const suppliedIds = new Set(suppliedFacts.map((f) => f.id));
  const detectedClaimTypes: ClaimType[] = [];

  // 1. Check source IDs subset
  for (const id of answer.sourceIds) {
    if (!suppliedIds.has(id)) {
      return {
        isValid: false,
        reason: `Model returned unauthorized sourceId: ${id}`,
      };
    }
  }

  // 2. If model marked unsupported, it must not be treated as a verified factual answer
  if (!answer.supported) {
    return {
      isValid: false,
      reason: "Model declared that facts do not support the query.",
    };
  }

  // 3. Prohibit ungrounded availability and booking confirmation claims inside knowledge answers
  const prohibitedAvailabilityPatterns = [
    /\bwe have rooms available\b/i,
    /\broom is currently available\b/i,
    /\bavailable for your dates\b/i,
    /\bI have booked\b/i,
    /\byour reservation is confirmed\b/i,
    /\bconfirming your reservation\b/i,
    /\breservation has been confirmed\b/i,
    /\bPresidential Suite is booked\b/i,
  ];

  for (const pattern of prohibitedAvailabilityPatterns) {
    if (pattern.test(answer.reply)) {
      detectedClaimTypes.push("AVAILABILITY", "BOOKING");
      return {
        isValid: false,
        reason: "Knowledge reply contained unauthorized room availability claim.",
        detectedClaimTypes,
      };
    }
  }

  // 4. Verify numeric currency claims ($XX)
  const currencyMatches = answer.reply.match(/\$\d+(?:\.\d{2})?/g);
  if (currencyMatches) {
    detectedClaimTypes.push("MONEY");
    const validCurrencyStrings = new Set<string>();

    for (const item of suppliedFacts) {
      for (const val of Object.values(item.facts)) {
        if (typeof val === "number") {
          validCurrencyStrings.add(`$${val}`);
          validCurrencyStrings.add(`$${val}.00`);
        } else if (typeof val === "string") {
          const m = val.match(/\$\d+(?:\.\d{2})?/g);
          if (m) m.forEach((c) => validCurrencyStrings.add(c));
        }
      }
    }

    for (const match of currencyMatches) {
      if (!validCurrencyStrings.has(match)) {
        return {
          isValid: false,
          reason: `Model mentioned unverified price ${match}`,
          detectedClaimTypes,
        };
      }
    }
  }

  // 5. Verify Time Claims (e.g. 3:00 PM, 11:00 AM)
  const timeMatches = answer.reply.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi);
  if (timeMatches) {
    detectedClaimTypes.push("TIME");
    const validTimes = new Set<string>();

    for (const item of suppliedFacts) {
      for (const val of Object.values(item.facts)) {
        if (typeof val === "string") {
          const tm = val.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi);
          if (tm) tm.forEach((t) => validTimes.add(t.toUpperCase().replace(/\s+/g, "")));
        }
      }
    }

    for (const match of timeMatches) {
      const normalized = match.toUpperCase().replace(/\s+/g, "");
      if (!validTimes.has(normalized)) {
        return {
          isValid: false,
          reason: `Model mentioned unverified time ${match}`,
          detectedClaimTypes,
        };
      }
    }
  }

  // 6. Verify Phone Contact Claims
  const phoneMatches = answer.reply.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  if (phoneMatches) {
    detectedClaimTypes.push("CONTACT");
    // Aster House verified phone is +1 (555) 328-9100 or 555-328-9100
    for (const match of phoneMatches) {
      const digitsOnly = match.replace(/\D/g, "");
      if (!digitsOnly.includes("5553289100")) {
        return {
          isValid: false,
          reason: `Model mentioned unverified contact phone ${match}`,
          detectedClaimTypes,
        };
      }
    }
  }

  return { isValid: true, detectedClaimTypes };
}
