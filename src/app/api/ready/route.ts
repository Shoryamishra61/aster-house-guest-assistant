import { NextResponse } from "next/server";
import { defaultKnowledgeGovernance } from "@/server/domain/knowledgeGovernance";
import { featureFlagManager } from "@/server/security/featureFlags";
import { checkAvailability } from "@/server/domain/availability";

export async function GET() {
  const flags = featureFlagManager.getFlags();

  // 1. Test Knowledge Capability
  let knowledgeStatus: "available" | "unavailable" = "available";
  let activeVersionNumber = 1;
  let factsCount = 0;
  try {
    const currentVersion = defaultKnowledgeGovernance.getCurrentVersion();
    activeVersionNumber = currentVersion.version;
    factsCount = currentVersion.items.length;
    if (factsCount === 0) {
      knowledgeStatus = "unavailable";
    }
  } catch {
    knowledgeStatus = "unavailable";
  }

  // 2. Test Availability Capability
  let availabilityStatus: "available" | "degraded" | "unavailable" = "available";
  if (!flags.availabilityProviderEnabled) {
    availabilityStatus = "unavailable";
  } else {
    try {
      // Execute self-check query to verify availability math and contract integrity
      const selfTest = checkAvailability("2026-11-01", "2026-11-03", 2);
      if (!selfTest.query || selfTest.query.nights !== 2) {
        availabilityStatus = "degraded";
      }
    } catch {
      availabilityStatus = "unavailable";
    }
  }

  // 3. Test LLM Capability
  const llmStatus = flags.groundedLlmPhrasing ? "active" : "disabled";

  // 4. Test Ingestion Capability
  const ingestionStatus = flags.opsIngestionEnabled ? "available" : "disabled";

  // Derive system readiness
  let status: "ready" | "degraded" | "not_ready" = "ready";
  if (knowledgeStatus === "unavailable" || (flags.availabilityProviderEnabled && availabilityStatus === "unavailable")) {
    status = "not_ready";
  } else if (
    availabilityStatus === "degraded" ||
    !flags.availabilityProviderEnabled ||
    !flags.groundedLlmPhrasing ||
    flags.forceDeterministicFaqOnly ||
    !flags.opsIngestionEnabled
  ) {
    status = "degraded";
  }

  return NextResponse.json({
    status,
    propertyId: "aster-house-main",
    capabilities: {
      knowledge: {
        status: knowledgeStatus,
        activeVersion: activeVersionNumber,
        factsCount,
      },
      availability: {
        status: availabilityStatus,
        provider: "deterministic_mock",
      },
      llm: {
        status: llmStatus,
        mode: process.env.MOCK_LLM === "false" ? "real" : "mock",
      },
      ingestion: {
        status: ingestionStatus,
      },
    },
    timestamp: new Date().toISOString(),
  });
}

