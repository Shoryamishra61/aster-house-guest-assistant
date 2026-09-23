/**
 * Aster House Guest Assistant - Privacy & PII Redaction Layer
 * Redacts emails, phone numbers, credit card numbers, auth headers, and secrets
 * before telemetry, logs, or external reporting.
 */

// Basic detection patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const US_PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const AUTH_HEADER_REGEX = /(?:Bearer\s+[A-Za-z0-9\-_.]+|Basic\s+[A-Za-z0-9+/=]+)/gi;
const API_KEY_REGEX = /(?:sk-[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{16,})/g;

export function redactPii(text: string): string {
  if (!text || typeof text !== "string") return text;

  return text
    .replace(CREDIT_CARD_REGEX, "[REDACTED_CREDIT_CARD]")
    .replace(AUTH_HEADER_REGEX, "[REDACTED_AUTH_TOKEN]")
    .replace(API_KEY_REGEX, "[REDACTED_API_KEY]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(US_PHONE_REGEX, "[REDACTED_PHONE]");
}

/**
 * Recursively redacts PII from objects, arrays, or primitives.
 */
export function sanitizeLogObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return redactPii(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogObject(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("authorization")
      ) {
        sanitized[key] = "[REDACTED_SECRET]";
      } else {
        sanitized[key] = sanitizeLogObject(value);
      }
    }
    return sanitized as T;
  }

  return obj;
}
