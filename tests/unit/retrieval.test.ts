import { describe, it, expect } from "vitest";
import { retrieveKnowledge } from "../../src/server/retrieval/retriever";
import { verifyGroundedAnswer } from "../../src/server/retrieval/verifier";
import { KNOWLEDGE_BASE } from "../../src/server/data/hotelData";

describe("Deterministic Retrieval", () => {
  it("retrieves check-in fact for check-in query", () => {
    const results = retrieveKnowledge("What time is check-in?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.id).toBe("kb_checkin_checkout");
  });

  it("retrieves swimming pool fact for pool query", () => {
    const results = retrieveKnowledge("Does the hotel have a swimming pool?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.id).toBe("kb_swimming_pool");
  });

  it("returns empty array for completely unsupported query", () => {
    const results = retrieveKnowledge("Do you offer hot air balloon rentals in the lobby?");
    expect(results).toHaveLength(0);
  });
});

describe("Post-generation Verifier", () => {
  it("passes when sourceIds are subset and facts support claims", () => {
    const poolItem = KNOWLEDGE_BASE.find((k) => k.id === "kb_swimming_pool")!;
    const res = verifyGroundedAnswer(
      {
        supported: true,
        reply: "Aster House features an indoor heated saltwater pool open daily until 10:00 PM.",
        sourceIds: ["kb_swimming_pool"],
      },
      [poolItem]
    );

    expect(res.isValid).toBe(true);
  });

  it("fails if model invents sourceIds not supplied", () => {
    const poolItem = KNOWLEDGE_BASE.find((k) => k.id === "kb_swimming_pool")!;
    const res = verifyGroundedAnswer(
      {
        supported: true,
        reply: "The pool is open daily.",
        sourceIds: ["kb_swimming_pool", "kb_invented_spa"],
      },
      [poolItem]
    );

    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("unauthorized sourceId");
  });

  it("fails if model claims room availability inside knowledge reply", () => {
    const poolItem = KNOWLEDGE_BASE.find((k) => k.id === "kb_swimming_pool")!;
    const res = verifyGroundedAnswer(
      {
        supported: true,
        reply: "Yes, we have a pool and we have rooms available for your stay.",
        sourceIds: ["kb_swimming_pool"],
      },
      [poolItem]
    );

    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("unauthorized room availability claim");
  });

  it("fails if model invents ungrounded price ($999)", () => {
    const breakfastItem = KNOWLEDGE_BASE.find((k) => k.id === "kb_breakfast")!;
    const res = verifyGroundedAnswer(
      {
        supported: true,
        reply: "Breakfast costs $999 per person.",
        sourceIds: ["kb_breakfast"],
      },
      [breakfastItem]
    );

    expect(res.isValid).toBe(false);
    expect(res.reason).toContain("unverified price");
  });
});
