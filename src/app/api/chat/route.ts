import { NextRequest, NextResponse } from "next/server";
import { ChatRequestSchema } from "@/shared/schemas";
import { ChatOrchestrator } from "@/server/orchestrator/router";
import { defaultRateLimiter } from "@/server/security/rateLimiter";
import { featureFlagManager } from "@/server/security/featureFlags";
import crypto from "crypto";

// Singleton orchestrator instance for server execution
const orchestrator = new ChatOrchestrator();

// In-memory idempotency cache for deduplicating repeated network requests
const idempotencyCache = new Map<string, { response: any; timestamp: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const idempotencyKey = req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key");

  // Check rate limit: higher burst allowance for localhost/test runner, 60 req/min for production IPs
  const limit = ip === "127.0.0.1" || ip === "::1" ? 250 : 60;
  const rateLimitResult = await defaultRateLimiter.check(`chat_${ip}`, limit, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        requestId: `req_rate_limited_${Date.now()}`,
        type: "error",
        message: "You have sent too many requests. Please wait a moment before sending another message.",
        retryable: true,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.resetSeconds),
        },
      }
    );
  }

  // Check idempotency cache if key provided
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey)!;
    // Cache for 2 minutes
    if (Date.now() - cached.timestamp < 120_000) {
      return NextResponse.json(cached.response, { status: 200, headers: { "X-Cache": "HIT-IDEMPOTENT" } });
    }
  }

  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          requestId,
          type: "error",
          message: "Invalid JSON in request body",
          retryable: false,
        },
        { status: 400 }
      );
    }

    const parseResult = ChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || "Validation error";
      return NextResponse.json(
        {
          requestId,
          type: "error",
          message: issue,
          retryable: false,
        },
        { status: 400 }
      );
    }

    const { message, sessionId, availability } = parseResult.data;

    // Check emergency kill switch for availability provider if availability query was submitted
    if (availability && !featureFlagManager.isEnabled("availabilityProviderEnabled")) {
      return NextResponse.json(
        {
          requestId,
          sessionId: sessionId || "anon",
          type: "error",
          message: "Live availability lookup is temporarily undergoing maintenance. Please call our front desk directly.",
          retryable: true,
        },
        { status: 503 }
      );
    }

    const response = await orchestrator.handleMessage({
      requestId,
      sessionId,
      message,
      availability,
    });

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { response, timestamp: Date.now() });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      {
        requestId,
        type: "error",
        message: "An unhandled server error occurred. Please try again shortly.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
