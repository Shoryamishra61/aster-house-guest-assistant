import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultKnowledgeGovernance } from "@/server/domain/knowledgeGovernance";
import { defaultEscalationService } from "@/server/domain/escalation";
import { defaultFeedbackService } from "@/server/domain/feedback";
import { featureFlagManager } from "@/server/security/featureFlags";

// Production Fail-Closed Authorization Guard
function authorizeOpsRequest(req: NextRequest): { authorized: boolean; operator: string; errorResponse?: NextResponse } {
  const isProduction = process.env.NODE_ENV === "production";
  const opsDemoMode = process.env.OPS_DEMO_MODE !== "false";

  // In production, demo mode is strictly disallowed
  if (isProduction && opsDemoMode && !process.env.OPS_ADMIN_SECRET) {
    return {
      authorized: false,
      operator: "unauthorized",
      errorResponse: NextResponse.json(
        { error: "AUTHORIZATION_ERROR: Ops demo mode is disabled in production without admin secret." },
        { status: 403 }
      ),
    };
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("x-ops-token");
  if (process.env.OPS_ADMIN_SECRET) {
    if (!authHeader || !authHeader.includes(process.env.OPS_ADMIN_SECRET)) {
      return {
        authorized: false,
        operator: "unauthorized",
        errorResponse: NextResponse.json(
          { error: "AUTHORIZATION_ERROR: Invalid or missing operator credentials." },
          { status: 401 }
        ),
      };
    }
  }

  return { authorized: true, operator: req.headers.get("x-operator-id") || "operator_supervisor" };
}

const UploadSchema = z.object({
  fileName: z.string().min(1),
  content: z.string().min(1),
  fileType: z.enum(["json", "csv", "txt", "md", "pdf"]),
  uploadedBy: z.string().default("operator"),
  propertyId: z.string().default("aster-house-main"),
});

const ActionSchema = z.object({
  action: z.enum(["approve_publish", "rollback", "update_flag", "resolve_escalation"]),
  sourceId: z.string().optional(),
  targetVersion: z.number().int().positive().optional(),
  flagKey: z.string().optional(),
  flagValue: z.boolean().optional(),
  escalationId: z.string().optional(),
  operator: z.string().default("operator_admin"),
});

export async function GET(req: NextRequest) {
  const auth = authorizeOpsRequest(req);
  if (!auth.authorized && auth.errorResponse) {
    return auth.errorResponse;
  }

  const currentVersion = defaultKnowledgeGovernance.getCurrentVersion();
  const versions = defaultKnowledgeGovernance.getAllVersions();
  const ingestionRecords = defaultKnowledgeGovernance.getIngestionRecords();
  const escalations = defaultEscalationService.getEscalations();
  const feedbackSummary = defaultFeedbackService.getSummary();
  const feedbackList = defaultFeedbackService.getFeedback().slice(0, 30);
  const flags = featureFlagManager.getFlags();
  const auditLog = defaultKnowledgeGovernance.getAuditLog().slice(0, 20);

  return NextResponse.json({
    knowledge: {
      currentVersion,
      versions,
      ingestionRecords,
      totalActiveFacts: currentVersion.items.length,
    },
    escalations,
    feedback: {
      summary: feedbackSummary,
      recent: feedbackList,
    },
    flags,
    auditLog,
    system: {
      status: "operational",
      mockLlm: process.env.MOCK_LLM !== "false",
      demoMode: process.env.OPS_DEMO_MODE !== "false",
      timestamp: Date.now(),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = authorizeOpsRequest(req);
    if (!auth.authorized && auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await req.json();

    // Check if it's a file upload for ingestion review
    if (body.fileName && body.content && body.fileType) {
      if (!featureFlagManager.isEnabled("opsIngestionEnabled")) {
        return NextResponse.json(
          { error: "Knowledge ingestion is currently disabled by system kill switch." },
          { status: 503 }
        );
      }

      const parsed = UploadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid upload payload", issues: parsed.error.issues }, { status: 400 });
      }

      const record = defaultKnowledgeGovernance.submitForReview(
        parsed.data.fileName,
        parsed.data.content,
        parsed.data.fileType,
        auth.operator || parsed.data.uploadedBy,
        parsed.data.propertyId
      );

      return NextResponse.json({ success: true, record });
    }

    // Action handling (approve_publish, rollback, flags, escalation)
    const actionParsed = ActionSchema.safeParse(body);
    if (!actionParsed.success) {
      return NextResponse.json({ error: "Invalid action payload", issues: actionParsed.error.issues }, { status: 400 });
    }

    const { action, sourceId, targetVersion, flagKey, flagValue, escalationId } = actionParsed.data;
    const operator = auth.operator || actionParsed.data.operator;

    if (action === "approve_publish") {
      if (!sourceId) {
        return NextResponse.json({ error: "sourceId is required for approve_publish" }, { status: 400 });
      }
      const newVersion = defaultKnowledgeGovernance.approveAndPublish(sourceId, operator);
      return NextResponse.json({ success: true, newVersion });
    }

    if (action === "rollback") {
      if (!targetVersion) {
        return NextResponse.json({ error: "targetVersion is required for rollback" }, { status: 400 });
      }
      const rolledBack = defaultKnowledgeGovernance.rollbackToVersion(targetVersion, operator);
      return NextResponse.json({ success: true, rolledBack });
    }

    if (action === "update_flag") {
      if (!flagKey || flagValue === undefined) {
        return NextResponse.json({ error: "flagKey and flagValue are required" }, { status: 400 });
      }
      featureFlagManager.setFlag(flagKey as any, flagValue);
      defaultKnowledgeGovernance.recordAudit({
        actor: operator,
        propertyId: "aster-house-main",
        action: "flag_update",
        details: { flagKey, flagValue },
      });
      return NextResponse.json({ success: true, flags: featureFlagManager.getFlags() });
    }

    if (action === "resolve_escalation") {
      if (!escalationId) {
        return NextResponse.json({ error: "escalationId is required" }, { status: 400 });
      }
      const resolved = defaultEscalationService.resolveEscalation(escalationId, operator);
      defaultKnowledgeGovernance.recordAudit({
        actor: operator,
        propertyId: "aster-house-main",
        action: "resolve_escalation",
        details: { escalationId, resolvedBy: operator },
      });
      return NextResponse.json({ success: true, resolved });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Internal error" }, { status: 500 });
  }
}
