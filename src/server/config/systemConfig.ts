import { z } from "zod";

/**
 * Aster House Guest Assistant - Central System Configuration Schema
 * Validates environment, timeouts, rate limits, file upload limits, and production fail-closed rules.
 */

export const SystemConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  mockLlm: z.boolean().default(true),
  opsDemoMode: z.boolean().default(false),
  availabilityProvider: z.enum(["deterministic_mock", "pms"]).default("deterministic_mock"),
  productionSafeOverride: z.boolean().default(false),

  // Operational limits
  maxUploadBytes: z.number().int().positive().default(5 * 1024 * 1024), // 5MB
  requestTimeoutMs: z.number().int().positive().default(10000), // 10s
  sessionTtlSeconds: z.number().int().positive().default(3600), // 1 hour
  idempotencyTtlSeconds: z.number().int().positive().default(60), // 60s
  rateLimitPerMinute: z.number().int().positive().default(60),

  // Property & Currency
  propertyId: z.string().min(1).default("aster-house-main"),
  timeZone: z.string().refine((tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid IANA time zone identifier" }).default("America/New_York"),
  currency: z.literal("USD").default("USD"),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

export class ConfigurationError extends Error {
  constructor(public code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "ConfigurationError";
  }
}

/**
 * Validates configuration and enforces fail-closed production rules (CONFIG-01 through CONFIG-07).
 */
export function validateSystemConfig(rawEnv: Record<string, string | undefined>): SystemConfig {
  const nodeEnv = (rawEnv.NODE_ENV || "development") as "development" | "test" | "production";
  const mockLlm = rawEnv.MOCK_LLM !== "false";
  const opsDemoMode = rawEnv.OPS_DEMO_MODE === "true";
  const availabilityProvider = (rawEnv.AVAILABILITY_PROVIDER || "deterministic_mock") as "deterministic_mock" | "pms";
  const productionSafeOverride = rawEnv.ALLOW_PRODUCTION_MOCKS === "true";

  const parsed = SystemConfigSchema.safeParse({
    nodeEnv,
    mockLlm,
    opsDemoMode,
    availabilityProvider,
    productionSafeOverride,
    maxUploadBytes: rawEnv.MAX_UPLOAD_BYTES ? Number(rawEnv.MAX_UPLOAD_BYTES) : undefined,
    requestTimeoutMs: rawEnv.REQUEST_TIMEOUT_MS ? Number(rawEnv.REQUEST_TIMEOUT_MS) : undefined,
    sessionTtlSeconds: rawEnv.SESSION_TTL_SECONDS ? Number(rawEnv.SESSION_TTL_SECONDS) : undefined,
    idempotencyTtlSeconds: rawEnv.IDEMPOTENCY_TTL_SECONDS ? Number(rawEnv.IDEMPOTENCY_TTL_SECONDS) : undefined,
    rateLimitPerMinute: rawEnv.RATE_LIMIT_PER_MINUTE ? Number(rawEnv.RATE_LIMIT_PER_MINUTE) : undefined,
    propertyId: rawEnv.PROPERTY_ID || "aster-house-main",
    timeZone: rawEnv.PROPERTY_TIMEZONE || "America/New_York",
    currency: (rawEnv.CURRENCY || "USD") as "USD",
  });

  if (!parsed.success) {
    throw new ConfigurationError("CONFIG_SCHEMA_INVALID", `Configuration validation failed: ${JSON.stringify(parsed.error.issues)}`);
  }

  const config = parsed.data;

  // Enforce Fail-Closed Production Invariants (P0-4)
  if (config.nodeEnv === "production") {
    // CONFIG-01: MOCK_LLM=true fails in production mode unless ALLOW_PRODUCTION_MOCKS=true is explicitly set
    if (config.mockLlm && !config.productionSafeOverride) {
      throw new ConfigurationError(
        "FAIL_CLOSED_PROD_MOCK_LLM",
        "STARTUP_HALTED: NODE_ENV=production cannot run with MOCK_LLM=true unless ALLOW_PRODUCTION_MOCKS=true is explicitly documented and configured."
      );
    }

    // CONFIG-02: OPS_DEMO_MODE=true fails in production unconditionally
    if (config.opsDemoMode) {
      throw new ConfigurationError(
        "FAIL_CLOSED_PROD_DEMO_AUTH",
        "STARTUP_HALTED: NODE_ENV=production cannot run with OPS_DEMO_MODE=true. Production requires authenticated operator credentials."
      );
    }

    // CONFIG-03: AVAILABILITY_PROVIDER=deterministic_mock fails in production mode unless ALLOW_PRODUCTION_MOCKS=true
    if (config.availabilityProvider === "deterministic_mock" && !config.productionSafeOverride) {
      throw new ConfigurationError(
        "FAIL_CLOSED_PROD_MOCK_AVAILABILITY",
        "STARTUP_HALTED: NODE_ENV=production requires a live PMS adapter unless ALLOW_PRODUCTION_MOCKS=true is explicitly provided."
      );
    }
  }

  return config;
}

export function getActiveSystemConfig(): SystemConfig {
  return validateSystemConfig(process.env);
}

