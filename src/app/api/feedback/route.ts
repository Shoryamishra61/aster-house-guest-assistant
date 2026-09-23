import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultFeedbackService, FeedbackReason } from "@/server/domain/feedback";
import { defaultRateLimiter } from "@/server/security/rateLimiter";

const FeedbackRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  propertyId: z.string().optional(),
  rating: z.enum(["helpful", "not_helpful"]),
  reason: z
    .enum(["incorrect", "didnt_answer", "outdated_information", "too_slow", "hard_to_use", "other"])
    .optional(),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateCheck = await defaultRateLimiter.check(`feedback_${ip}`, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please slow down." },
        { status: 429, headers: { "Retry-After": String(rateCheck.resetSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = FeedbackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid feedback payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const record = defaultFeedbackService.submitFeedback({
      requestId: parsed.data.requestId,
      sessionId: parsed.data.sessionId,
      propertyId: parsed.data.propertyId,
      rating: parsed.data.rating,
      reason: parsed.data.reason as FeedbackReason | undefined,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ success: true, recordId: record.id });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const summary = defaultFeedbackService.getSummary();
  const recent = defaultFeedbackService.getFeedback().slice(0, 50);
  return NextResponse.json({ summary, recent });
}
