import crypto from "crypto";
import { sanitizeLogObject } from "../security/pii";

export type LogEvent = {
  event: string;
  requestId: string;
  propertyId?: string;
  sessionIdHash?: string;
  intent?: string;
  route?: string;
  latencyMs?: number;
  llmCalls?: number;
  toolCalls?: number;
  fallback?: boolean;
  errorCode?: string | null;
  details?: Record<string, unknown>;
};

export function hashSessionId(sessionId?: string): string {
  if (!sessionId) return "anonymous";
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 12);
}

export const logger = {
  info(event: LogEvent): void {
    if (process.env.NODE_ENV !== "test" || process.env.FORCE_LOGGER_OUTPUT === "true") {
      const sanitized = sanitizeLogObject(event);
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", ...sanitized }));
    }
  },
  warn(event: LogEvent): void {
    if (process.env.NODE_ENV !== "test") {
      const sanitized = sanitizeLogObject(event);
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: "warn", ...sanitized }));
    }
  },
  error(event: LogEvent): void {
    if (process.env.NODE_ENV !== "test") {
      const sanitized = sanitizeLogObject(event);
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", ...sanitized }));
    }
  },
};
