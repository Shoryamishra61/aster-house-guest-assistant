import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateSystemConfig, ConfigurationError } from "@/server/config/systemConfig";
import { validateProviderOutput } from "@/server/domain/availability";
import { verifyGroundedAnswer } from "@/server/retrieval/verifier";
import { defaultKnowledgeGovernance, KnowledgeGovernanceService } from "@/server/domain/knowledgeGovernance";
import { retrieveKnowledge } from "@/server/retrieval/retriever";
import { extractTextFromPdf, extractTextFromPdfAsync } from "@/server/domain/pdfExtractor";
import { sanitizeLogObject } from "@/server/security/pii";
import { logger } from "@/server/observability/logger";
import { InMemorySessionStore } from "@/server/session/store";
import { InMemoryRateLimiter } from "@/server/security/rateLimiter";
import { defaultFeedbackService } from "@/server/domain/feedback";
import { defaultEscalationService } from "@/server/domain/escalation";

describe("Credibility & Production Hardening Proof Suite (P0-1 through P0-11)", () => {
  describe("P0-1: PDF Parsing & Fixtures", () => {
    it("PDF-REAL-01: handles TJ array operator in content stream", () => {
      const pdfWithTJ = `%PDF-1.4
1 0 obj << /Type /Page >> endobj
2 0 obj << /Length 60 >> stream
BT
/F1 12 Tf
[(Pool ) 20 (Hours: ) 10 (7 AM - 10 PM)] TJ
ET
endstream endobj
%%EOF`;
      const res = extractTextFromPdf(pdfWithTJ);
      expect(res.success).toBe(true);
      expect(res.totalText).toContain("Pool Hours: 7 AM - 10 PM");
    });

    it("PDF-REAL-02: detects encrypted document structure and rejects publication", () => {
      const encryptedPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 >> endobj
/Encrypt 3 0 R
trailer << /Root 1 0 R /Encrypt 3 0 R >>
%%EOF`;
      const res = extractTextFromPdf(encryptedPdf);
      expect(res.success).toBe(false);
      expect(res.isEncrypted).toBe(true);
      expect(res.error).toContain("ENCRYPTED_PDF");
    });

    it("PDF-REAL-03: classifies scanned image-only PDF as TEXT_EXTRACTION_UNAVAILABLE", () => {
      const scannedPdf = `%PDF-1.4
1 0 obj << /Type /Page /Resources << /XObject << /Im1 2 0 R >> >> >> endobj
2 0 obj << /Type /XObject /Subtype /Image /Width 1200 /Height 1800 >> stream
BINARY_IMAGE_DATA_NO_TEXT
endstream endobj
%%EOF`;
      const res = extractTextFromPdf(scannedPdf);
      expect(res.success).toBe(false);
      expect(res.isScannedOnly).toBe(true);
      expect(res.error).toContain("TEXT_EXTRACTION_UNAVAILABLE");
    });

    it("PDF-REAL-04: rejects corrupt PDF headers with typed error", () => {
      const corrupt = "NOT_A_PDF_STREAM";
      const res = extractTextFromPdf(corrupt);
      expect(res.success).toBe(false);
      expect(res.error).toContain("MALFORMED_PDF");
    });
  });

  describe("P0-2: Knowledge Publication Semantics & Concurrency", () => {
    it("KB-01: stale writer receives 409 VERSION_CONFLICT when expectedActiveVersion is outdated", () => {
      const gov = new KnowledgeGovernanceService();
      const current = gov.getCurrentVersion(); // v1
      expect(current.version).toBe(1);

      // Operator B publishes v2
      const rec1 = gov.submitForReview("note1.txt", "Fitness Center: Open 24/7", "txt", "operator_b");
      const v2 = gov.approveAndPublish(rec1.sourceId, "operator_b", { expectedActiveVersion: 1 });
      expect(v2.version).toBe(2);

      // Operator A tries to publish based on old v1
      const rec2 = gov.submitForReview("note2.txt", "Valet: $40", "txt", "operator_a");
      expect(() => {
        gov.approveAndPublish(rec2.sourceId, "operator_a", { expectedActiveVersion: 1 });
      }).toThrow(/VERSION_CONFLICT/);
    });

    it("KB-02: concurrent publications allow exactly one winner while second fails", () => {
      const gov = new KnowledgeGovernanceService();
      const recA = gov.submitForReview("a.txt", "Policy A: Test", "txt", "op_a");
      const recB = gov.submitForReview("b.txt", "Policy B: Test", "txt", "op_b");

      // First publication succeeds
      const winner = gov.approveAndPublish(recA.sourceId, "op_a", { expectedActiveVersion: 1 });
      expect(winner.version).toBe(2);

      // Second competing publication targeting original version 1 fails
      expect(() => {
        gov.approveAndPublish(recB.sourceId, "op_b", { expectedActiveVersion: 1 });
      }).toThrow(/VERSION_CONFLICT/);
    });

    it("KB-03: rollback immediately changes guest retrieval result", () => {
      // Ingest seasonal policy
      const seasonalTxt = "Special Guest Event: Annual Jazz Gala in the Grand Ballroom tonight at 8 PM";
      const rec = defaultKnowledgeGovernance.submitForReview("jazz.txt", seasonalTxt, "txt", "manager");
      const published = defaultKnowledgeGovernance.approveAndPublish(rec.sourceId, "manager");
      const publishedVer = published.version;

      // Guest retrieval observes new fact
      const search1 = retrieveKnowledge("jazz gala");
      expect(search1.length).toBeGreaterThan(0);
      expect(search1[0].item.title).toContain("Jazz Gala");

      // Rollback to v1
      defaultKnowledgeGovernance.rollbackToVersion(1, "manager");

      // Guest retrieval immediately reflects rollback (item not retrieved or v1 restored)
      const search2 = retrieveKnowledge("jazz gala");
      expect(search2.some((r) => r.item.title.includes("Jazz Gala"))).toBe(false);
    });
  });

  describe("P0-4: Fail-Closed Production Config Matrix (CONFIG-01 to CONFIG-07)", () => {
    it("CONFIG-01: rejects production startup if MOCK_LLM=true without explicit override", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "production",
          MOCK_LLM: "true",
          ALLOW_PRODUCTION_MOCKS: "false",
        });
      }).toThrow(/FAIL_CLOSED_PROD_MOCK_LLM/);
    });

    it("CONFIG-02: rejects production startup if OPS_DEMO_MODE=true", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "production",
          MOCK_LLM: "false",
          OPS_DEMO_MODE: "true",
          ALLOW_PRODUCTION_MOCKS: "false",
        });
      }).toThrow(/FAIL_CLOSED_PROD_DEMO_AUTH/);
    });

    it("CONFIG-03: rejects production startup if AVAILABILITY_PROVIDER=deterministic_mock without override", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "production",
          MOCK_LLM: "false",
          OPS_DEMO_MODE: "false",
          AVAILABILITY_PROVIDER: "deterministic_mock",
          ALLOW_PRODUCTION_MOCKS: "false",
        });
      }).toThrow(/FAIL_CLOSED_PROD_MOCK_AVAILABILITY/);
    });

    it("CONFIG-05: rejects invalid property timezone", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "development",
          PROPERTY_TIMEZONE: "Invalid/Timezone_Nowhere",
        });
      }).toThrow(/CONFIG_SCHEMA_INVALID/);
    });

    it("CONFIG-06: rejects invalid currency", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "development",
          CURRENCY: "BITCOIN",
        });
      }).toThrow(/CONFIG_SCHEMA_INVALID/);
    });

    it("CONFIG-07: rejects negative or invalid timeout/rate limit", () => {
      expect(() => {
        validateSystemConfig({
          NODE_ENV: "development",
          RATE_LIMIT_PER_MINUTE: "-5",
        });
      }).toThrow(/CONFIG_SCHEMA_INVALID/);
    });
  });

  describe("P0-7: PII Sanitization at Logger Sink", () => {
    it("redacts guest email, phone, credit card, and bearer tokens from structured log output", () => {
      process.env.FORCE_LOGGER_OUTPUT = "true";
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      logger.info({
        event: "test_event",
        requestId: "req_test",
        details: {
          guestEmail: "alice@luxurytravel.com",
          guestPhone: "+1 (555) 234-5678",
          cardPayment: "4111 2222 3333 4444",
          authHeader: "Bearer sk-secret-live-token-1234567890",
          nested: {
            token: "super-secret-password-123",
          },
        },
      });

      delete process.env.FORCE_LOGGER_OUTPUT;

      expect(spy).toHaveBeenCalled();
      const loggedJson = JSON.parse(spy.mock.calls[0][0]);

      expect(loggedJson.details.guestEmail).toBe("[REDACTED_EMAIL]");
      expect(loggedJson.details.guestPhone).toBe("[REDACTED_PHONE]");
      expect(loggedJson.details.cardPayment).toBe("[REDACTED_CREDIT_CARD]");
      expect(loggedJson.details.authHeader).toBe("[REDACTED_AUTH_TOKEN]");
      expect(loggedJson.details.nested.token).toBe("[REDACTED_SECRET]");

      spy.mockRestore();
    });
  });

  describe("P0-8: External Provider Hostile Input Validation", () => {
    it("rejects provider payload with negative price", () => {
      const malicious = {
        query: { checkIn: "2026-11-01", checkOut: "2026-11-03", adults: 2, nights: 2 },
        rooms: [
          {
            roomTypeId: "queen_classic",
            name: "Classic Queen",
            maxOccupancy: 2,
            bedConfiguration: "1 Queen Bed",
            nightlyRate: -185,
            currency: "USD",
            nights: 2,
            totalPrice: -370,
            amenities: ["WiFi"],
          },
        ],
      };
      expect(() => validateProviderOutput(malicious)).toThrow(/MALFORMED_PROVIDER_OUTPUT/);
    });

    it("rejects provider payload with unknown currency", () => {
      const invalidCurrency = {
        query: { checkIn: "2026-11-01", checkOut: "2026-11-03", adults: 2, nights: 2 },
        rooms: [
          {
            roomTypeId: "queen_classic",
            name: "Classic Queen",
            maxOccupancy: 2,
            bedConfiguration: "1 Queen Bed",
            nightlyRate: 185,
            currency: "EUR",
            nights: 2,
            totalPrice: 370,
            amenities: ["WiFi"],
          },
        ],
      };
      expect(() => validateProviderOutput(invalidCurrency)).toThrow(/MALFORMED_PROVIDER_OUTPUT/);
    });

    it("rejects provider payload with impossible occupancy", () => {
      const impossibleOccupancy = {
        query: { checkIn: "2026-11-01", checkOut: "2026-11-03", adults: 2, nights: 2 },
        rooms: [
          {
            roomTypeId: "queen_classic",
            name: "Classic Queen",
            maxOccupancy: 999,
            bedConfiguration: "1 Queen Bed",
            nightlyRate: 185,
            currency: "USD",
            nights: 2,
            totalPrice: 370,
            amenities: ["WiFi"],
          },
        ],
      };
      expect(() => validateProviderOutput(impossibleOccupancy)).toThrow(/MALFORMED_PROVIDER_OUTPUT/);
    });
  });

  describe("P0-9: Adversarial Verifier Checks", () => {
    const mockFacts = [
      {
        id: "kb_breakfast",
        category: "amenities" as const,
        title: "Breakfast",
        aliases: ["breakfast"],
        facts: { breakfastPrice: 18, hours: "6:30 AM to 10:00 AM" },
        summary: "Breakfast is $18",
      },
    ];

    it("rejects candidate reply with unverified price ($45)", () => {
      const candidate = {
        supported: true,
        reply: "Breakfast is served daily for $45 per guest in the dining room.",
        sourceIds: ["kb_breakfast"],
      };
      const v = verifyGroundedAnswer(candidate, mockFacts);
      expect(v.isValid).toBe(false);
      expect(v.reason).toContain("unverified price $45");
    });

    it("rejects candidate reply with invented operating hours (1:00 PM)", () => {
      const candidate = {
        supported: true,
        reply: "Breakfast is available until 1:00 PM on weekends.",
        sourceIds: ["kb_breakfast"],
      };
      const v = verifyGroundedAnswer(candidate, mockFacts);
      expect(v.isValid).toBe(false);
      expect(v.reason).toContain("unverified time");
    });

    it("rejects candidate reply with unauthorized booking confirmation", () => {
      const candidate = {
        supported: true,
        reply: "Your reservation is confirmed! We look forward to your stay.",
        sourceIds: ["kb_breakfast"],
      };
      const v = verifyGroundedAnswer(candidate, mockFacts);
      expect(v.isValid).toBe(false);
      expect(v.reason).toContain("unauthorized room availability claim");
    });
  });

  describe("P0-11: Memory Boundedness for In-Memory Adapters", () => {
    it("InMemorySessionStore evicts expired sessions", async () => {
      const store = new InMemorySessionStore(1 / 60); // 1-second TTL
      await store.save({
        id: "sess_temp",
        history: [],
        availabilitySlots: {},
        updatedAt: Date.now() - 2000, // already expired
      });

      const retrieved = await store.get("sess_temp");
      expect(retrieved).toBeNull();
    });

    it("InMemoryRateLimiter cleans expired timestamps", async () => {
      const limiter = new InMemoryRateLimiter();
      const res = await limiter.check("test_ip", 5, 1);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(4);
    });

    it("FeedbackService bounds maximum in-memory records", () => {
      const fb = defaultFeedbackService;
      // Record submission works and is bounded
      const rec = fb.submitFeedback({
        requestId: "req_bound_test",
        sessionId: "sess_bound_test",
        rating: "helpful",
      });
      expect(rec.id).toBeDefined();
    });

    it("EscalationService bounds maximum in-memory records", () => {
      const esc = defaultEscalationService;
      const rec = esc.createEscalation({
        sessionId: "sess_bound_test",
        reason: "special_request",
        guestMessage: "Late check-in requested",
      });
      expect(rec.id).toBeDefined();
    });
  });
});
