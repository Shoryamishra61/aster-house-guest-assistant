import { describe, it, expect, beforeEach } from "vitest";
import { ChatOrchestrator } from "../../src/server/orchestrator/router";
import { InMemorySessionStore } from "../../src/server/session/store";

describe("Cross-Language Truth Equivalence (LANG-TRUTH-01 to LANG-TRUTH-10)", () => {
  let orchestrator: ChatOrchestrator;

  beforeEach(() => {
    orchestrator = new ChatOrchestrator({
      sessionStore: new InMemorySessionStore(),
    });
  });

  // LANG-TRUTH-01: Check-in Time
  it("LANG-TRUTH-01: check-in time resolves to canonical 3:00 PM across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_01_en", message: "What time is check-in?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_01_hi", message: "चेक-इन कितने बजे है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_01_hien", message: "Check-in kitne baje hai?" });

    expect(en.type).toBe("answer");
    expect(hi.type).toBe("answer");
    expect(hien.type).toBe("answer");

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("3:00 PM");
      expect(hi.message).toContain("3:00");
      expect(hien.message).toContain("3:00 PM");
      expect(en.sources.some((s) => s.id === "kb_checkin_checkout")).toBe(true);
      expect(hi.sources.some((s) => s.id === "kb_checkin_checkout")).toBe(true);
      expect(hien.sources.some((s) => s.id === "kb_checkin_checkout")).toBe(true);
    }
  });

  // LANG-TRUTH-02: Check-out Time
  it("LANG-TRUTH-02: check-out time resolves to canonical 11:00 AM across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_02_en", message: "What time is check-out?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_02_hi", message: "चेक-आउट कब है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_02_hien", message: "Check-out kab hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("11:00 AM");
      expect(hi.message).toContain("11:00");
      expect(hien.message).toContain("11:00 AM");
    }
  });

  // LANG-TRUTH-03: Breakfast Price
  it("LANG-TRUTH-03: breakfast price resolves to canonical $18 across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_03_en", message: "How much does breakfast cost?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_03_hi", message: "नाश्ते की क्या कीमत है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_03_hien", message: "Breakfast ka kitna charge hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("$18");
      expect(hi.message).toContain("$18");
      expect(hien.message).toContain("$18");
    }
  });

  // LANG-TRUTH-04: Breakfast Inclusion
  it("LANG-TRUTH-04: breakfast inclusion rules resolve to King Deluxe & Executive Suite across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_04_en", message: "Is breakfast complimentary?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_04_hi", message: "क्या नाश्ता मुफ़्त शामिल है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_04_hien", message: "Breakfast free hai kya?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("King Deluxe");
      expect(en.message).toContain("Executive Family Suite");
      expect(hien.message).toContain("King Deluxe");
      expect(hien.message).toContain("Executive Family Suite");
      expect(hi.message).toContain("किंग डीलक्स");
      expect(hi.message).toContain("एग्जीक्यूटिव फैमिली सुइट");
    }
  });

  // LANG-TRUTH-05: Pool Hours & Type
  it("LANG-TRUTH-05: pool hours resolve to 7:00 AM to 10:00 PM across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_05_en", message: "What are the pool hours?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_05_hi", message: "पूल का समय क्या है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_05_hien", message: "Pool kab se kab tak open rehta hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("7:00 AM");
      expect(en.message).toContain("10:00 PM");
      expect(hi.message).toContain("7:00");
      expect(hi.message).toContain("10:00");
      expect(hien.message).toContain("7:00 AM");
      expect(hien.message).toContain("10:00 PM");
    }
  });

  // LANG-TRUTH-06: Parking Price
  it("LANG-TRUTH-06: parking price resolves to canonical $35 valet across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_06_en", message: "How much is parking?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_06_hi", message: "पार्किंग का क्या शुल्क है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_06_hien", message: "Parking ka charge kitna hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("$35");
      expect(hi.message).toContain("$35");
      expect(hien.message).toContain("$35");
    }
  });

  // LANG-TRUTH-07: Pet Fee
  it("LANG-TRUTH-07: pet fee resolves to canonical $50 per stay across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_07_en", message: "What is the pet fee?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_07_hi", message: "पालतू जानवरों का क्या शुल्क है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_07_hien", message: "Pet charge kitna hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("$50");
      expect(hi.message).toContain("$50");
      expect(hien.message).toContain("$50");
    }
  });

  // LANG-TRUTH-08: Room Rates
  it("LANG-TRUTH-08: room rates resolve consistently across room catalog", async () => {
    const res = await orchestrator.handleMessage({ requestId: "lt_08_en", message: "What room types do you have?" });
    expect(res.type).toBe("answer");
    if (res.type === "answer") {
      expect(res.message).toContain("Classic Queen ($185/night");
      expect(res.message).toContain("King Deluxe ($245/night");
      expect(res.message).toContain("Double Queen Suite ($310/night");
      expect(res.message).toContain("Executive Family Suite ($420/night");
    }
  });

  // LANG-TRUTH-09: Room Occupancy
  it("LANG-TRUTH-09: room occupancy limits resolve consistently (2, 2, 4, 5)", async () => {
    const resSuitability = await orchestrator.handleMessage({ requestId: "lt_09_en", message: "Which room is suitable for 3 guests?" });
    expect(resSuitability.type).toBe("room_suitability");
    if (resSuitability.type === "room_suitability") {
      const roomNames = resSuitability.rooms.map((r) => r.name);
      expect(roomNames).toContain("Double Queen Suite");
      expect(roomNames).toContain("Executive Family Suite");
      expect(roomNames).not.toContain("Classic Queen");
      expect(roomNames).not.toContain("King Deluxe");
    }
  });

  // LANG-TRUTH-10: Cancellation Policy Notice
  it("LANG-TRUTH-10: cancellation notice resolves to 48 hours across EN, HI, Hinglish", async () => {
    const en = await orchestrator.handleMessage({ requestId: "lt_10_en", message: "What is your cancellation policy?" });
    const hi = await orchestrator.handleMessage({ requestId: "lt_10_hi", message: "रद्दीकरण नीति क्या है?" });
    const hien = await orchestrator.handleMessage({ requestId: "lt_10_hien", message: "Cancellation policy kya hai?" });

    if (en.type === "answer" && hi.type === "answer" && hien.type === "answer") {
      expect(en.message).toContain("48 hours");
      expect(hi.message).toContain("48 घंटे");
      expect(hien.message).toContain("48 hours");
    }
  });
});
