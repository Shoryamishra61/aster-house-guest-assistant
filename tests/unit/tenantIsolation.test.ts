import { describe, it, expect } from "vitest";
import { getPropertyConfig, REGISTERED_PROPERTIES } from "@/server/domain/propertyConfig";
import { KnowledgeGovernanceService } from "@/server/domain/knowledgeGovernance";
import { EscalationService } from "@/server/domain/escalation";
import { FeedbackService } from "@/server/domain/feedback";

describe("Tenant & Property Isolation Invariants (TENANT-01 to TENANT-06)", () => {
  it("TENANT-01: resolves trusted property config and rejects unauthorized tenant IDs", () => {
    const aster = getPropertyConfig("aster-house-main");
    expect(aster.name).toBe("Aster House");
    expect(aster.timeZone).toBe("America/New_York");

    const harbor = getPropertyConfig("harbor-house-test");
    expect(harbor.name).toBe("Harbor House Test Property");
    expect(harbor.timeZone).toBe("America/Los_Angeles");

    expect(() => getPropertyConfig("evil-property-corp")).toThrow(/TENANT_ERROR: Unknown propertyId/);
  });

  it("TENANT-02: knowledge base versions and items are strictly scoped to propertyId", () => {
    const gov = new KnowledgeGovernanceService();
    const active = gov.getCurrentVersion();
    expect(active.propertyId).toBe("aster-house-main");

    // Ingest a policy into another property
    const record = gov.submitForReview(
      "wharf_policy.txt",
      "Docking Fee: $50 per day",
      "txt",
      "wharf_manager",
      "harbor-house-test"
    );
    expect(record.propertyId).toBe("harbor-house-test");

    const v2 = gov.approveAndPublish(record.sourceId, "wharf_manager", { propertyId: "harbor-house-test" });
    expect(v2.propertyId).toBe("harbor-house-test");
  });

  it("TENANT-03: human escalation records are partitioned by propertyId without cross-tenant bleed", () => {
    const escService = new EscalationService();
    escService.createEscalation({
      propertyId: "aster-house-main",
      sessionId: "sess_aster_1",
      reason: "complaint",
      guestMessage: "No towels in room 302",
    });

    escService.createEscalation({
      propertyId: "harbor-house-test",
      sessionId: "sess_harbor_2",
      reason: "special_request",
      guestMessage: "Boat slip reservation needed",
    });

    const asterList = escService.getEscalations("aster-house-main");
    const harborList = escService.getEscalations("harbor-house-test");

    expect(asterList.length).toBe(1);
    expect(asterList[0].guestMessage).toContain("No towels");

    expect(harborList.length).toBe(1);
    expect(harborList[0].guestMessage).toContain("Boat slip");
  });

  it("TENANT-04: guest feedback is strictly partitioned by propertyId", () => {
    const fbService = new FeedbackService();
    fbService.submitFeedback({
      requestId: "req_a1",
      sessionId: "sess_a1",
      propertyId: "aster-house-main",
      rating: "helpful",
    });
    fbService.submitFeedback({
      requestId: "req_h1",
      sessionId: "sess_h1",
      propertyId: "harbor-house-test",
      rating: "not_helpful",
      reason: "too_slow",
    });

    const asterSummary = fbService.getSummary("aster-house-main");
    const harborSummary = fbService.getSummary("harbor-house-test");

    expect(asterSummary.total).toBe(1);
    expect(asterSummary.helpful).toBe(1);

    expect(harborSummary.total).toBe(1);
    expect(harborSummary.notHelpful).toBe(1);
  });
});
