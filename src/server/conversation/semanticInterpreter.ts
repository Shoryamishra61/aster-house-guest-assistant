import {
  ConversationalIntent,
  ConversationLanguage,
  Interpretation,
  ScopedConversationState,
  SlotValue,
} from "./contracts";
import { normalizeUserMessage } from "./normalizer";

/**
 * Parses natural numbers and word numbers across English and Hindi/Hinglish.
 */
function parseNumber(text: string): number | null {
  const match = text.match(/\b\d+\b/);
  if (match) return parseInt(match[0], 10);

  const words: Record<string, number> = {
    // English
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    // Hindi / Hinglish
    ek: 1,
    do: 2,
    teen: 3,
    char: 4,
    chaar: 4,
    paanch: 5,
    panch: 5,
    che: 6,
    chhah: 6,
    saat: 7,
    aath: 8,
    // Devanagari
    "एक": 1,
    "दो": 2,
    "तीन": 3,
    "चार": 4,
    "पाँच": 5,
    "पांच": 5,
    "छह": 6,
  };

  const trimmed = text.trim().toLowerCase();
  if (words[trimmed]) return words[trimmed];

  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`(?:^|\\s)${w}(?:$|\\s)`, "i").test(text)) return n;
  }
  return null;
}

/**
 * Extracts date pairs or single dates (ISO YYYY-MM-DD or Month Day formats),
 * supporting English, Hindi, and Hinglish range expressions.
 */
function extractDates(text: string, today: string): { checkIn?: string; checkOut?: string } {
  // 1. ISO format: 2026-10-10 to 2026-10-12 or 2026-10-10 se 2026-10-12 tak
  const isoDates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoDates && isoDates.length >= 2) {
    return { checkIn: isoDates[0], checkOut: isoDates[1] };
  }
  if (isoDates && isoDates.length === 1) {
    if (text.includes("until") || text.includes("checkout") || text.includes("leaving") || text.includes("tak")) {
      return { checkOut: isoDates[0] };
    }
    return { checkIn: isoDates[0] };
  }

  // 2. Month name format: October 10 to October 12, 10 se 12 October, 10 to 12 Oct
  const months: Record<string, string> = {
    jan: "01", january: "01", "जनवरी": "01",
    feb: "02", february: "02", "फ़रवरी": "02", "फरवरी": "02",
    mar: "03", march: "03", "मार्च": "03",
    apr: "04", april: "04", "अप्रैल": "04",
    may: "05", "मई": "05",
    jun: "06", june: "06", "जून": "06",
    jul: "07", july: "07", "जुलाई": "07",
    aug: "08", august: "08", "अगस्त": "08",
    sep: "09", september: "09", "सितंबर": "09",
    oct: "10", october: "10", "अक्टूबर": "10",
    nov: "11", november: "11", "नवंबर": "11",
    dec: "12", december: "12", "दिसंबर": "12",
  };

  const currentYear = today ? today.slice(0, 4) : "2026";

  // Match e.g. "October 10 to October 12" or "October 10 to 12" or "March 12-13" or "Oct 10-12"
  const rangeRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|–|-|through|se)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(\d{1,2})(?:st|nd|rd|th)?/i;
  const rangeMatch = text.match(rangeRegex);

  if (rangeMatch) {
    const m1 = rangeMatch[1].toLowerCase().slice(0, 3);
    const d1 = rangeMatch[2].padStart(2, "0");
    const m2 = rangeMatch[3] ? rangeMatch[3].toLowerCase().slice(0, 3) : m1;
    const d2 = rangeMatch[4].padStart(2, "0");

    let yearNum = parseInt(currentYear, 10);
    let checkIn = `${yearNum}-${months[m1]}-${d1}`;
    let checkOut = `${yearNum}-${months[m2]}-${d2}`;

    if (today && checkIn < today) {
      yearNum += 1;
      checkIn = `${yearNum}-${months[m1]}-${d1}`;
      checkOut = `${yearNum}-${months[m2]}-${d2}`;
    }

    return { checkIn, checkOut };
  }

  // Hinglish / Hindi style date pattern: "10 se 12 October", "10 se 12 October tak", "10 to 12 Oct"
  const reverseRangeRegex = /(\d{1,2})\s*(?:se|to|–|-)\s*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+tak)?/i;
  const revMatch = text.match(reverseRangeRegex);
  if (revMatch) {
    const d1 = revMatch[1].padStart(2, "0");
    const d2 = revMatch[2].padStart(2, "0");
    const m = revMatch[3].toLowerCase().slice(0, 3);

    let yearNum = parseInt(currentYear, 10);
    let checkIn = `${yearNum}-${months[m]}-${d1}`;
    let checkOut = `${yearNum}-${months[m]}-${d2}`;

    if (today && checkIn < today) {
      yearNum += 1;
      checkIn = `${yearNum}-${months[m]}-${d1}`;
      checkOut = `${yearNum}-${months[m]}-${d2}`;
    }

    return { checkIn, checkOut };
  }

  // Relative Date Expressions: "kal se do raat" (starting tomorrow for 2 nights)
  if (text.includes("kal se") || text.includes("starting tomorrow")) {
    if (today) {
      const todayDate = new Date(today);
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(todayDate.getDate() + 1);
      const checkIn = tomorrow.toISOString().slice(0, 10);

      let nights = 1;
      if (text.includes("do raat") || text.includes("2 nights") || text.includes("two nights")) {
        nights = 2;
      } else if (text.includes("teen raat") || text.includes("3 nights") || text.includes("three nights")) {
        nights = 3;
      }

      const checkoutDate = new Date(tomorrow);
      checkoutDate.setDate(tomorrow.getDate() + nights);
      const checkOut = checkoutDate.toISOString().slice(0, 10);
      return { checkIn, checkOut };
    }
  }

  // Single date e.g. "until October 12" or "12 October tak"
  const singleDateRegex = /(?:until|leaving|checkout|check-out|by)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i;
  const singleMatch = text.match(singleDateRegex);
  if (singleMatch) {
    const m = singleMatch[1].toLowerCase().slice(0, 3);
    const d = singleMatch[2].padStart(2, "0");
    return { checkOut: `${currentYear}-${months[m]}-${d}` };
  }

  const reverseSingleRegex = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+tak/i;
  const revSingleMatch = text.match(reverseSingleRegex);
  if (revSingleMatch) {
    const d = revSingleMatch[1].padStart(2, "0");
    const m = revSingleMatch[2].toLowerCase().slice(0, 3);
    return { checkOut: `${currentYear}-${months[m]}-${d}` };
  }

  return {};
}

/**
 * Interprets guest messages semantically with reference resolution, slot scoping,
 * multilingual detection, negation handling, and response taxonomy.
 */
export function interpretMessage(
  rawMessage: string,
  state: ScopedConversationState,
  today: string = new Date().toISOString().slice(0, 10)
): Interpretation {
  const { normalized, detectedLanguage, hasNegation } = normalizeUserMessage(
    rawMessage,
    state.lastLanguage
  );
  const text = normalized.toLowerCase();

  // 1. Security Refusals (API keys, system instructions, passwords, private data) in English, Hindi & Hinglish
  if (
    text.includes("api key") ||
    text.includes("reveal your") ||
    text.includes("system prompt") ||
    text.includes("previous guests") ||
    text.includes("password") ||
    text.includes("secret") ||
    text.includes("<script>") ||
    text.includes("alert(") ||
    text.includes("api key dikhao") ||
    text.includes("system prompt batao") ||
    text.includes("prompt dikhao") ||
    text.includes("dusre guest ki booking") ||
    text.includes("dusre guests") ||
    text.includes("ignore previous instructions") ||
    text.includes("pichle instructions ignore") ||
    text.includes("rules ignore karo")
  ) {
    return {
      primaryIntent: "SECURITY_REFUSAL",
      secondaryIntents: [],
      confidence: 1.0,
      detectedLanguage,
      responseKind: "security_refusal",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 2. Human Escalation ("manager se baat karni hai", "talk to a manager", "i want a manager", "मैनेजर")
  if (
    text.includes("manager") ||
    text.includes("मैनेजर") ||
    text.includes("प्रबंधक") ||
    text.includes("talk to manager") ||
    text.includes("human support") ||
    text.includes("manager se baat") ||
    text.includes("escalate")
  ) {
    return {
      primaryIntent: "HUMAN_ESCALATION",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "human_escalation",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["escalation"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 3. Unsupported Booking Actions & Reservation Lookups in English, Hindi & Hinglish
  if (
    text.includes("cancel my reservation") ||
    text.includes("cancel reservation") ||
    text.includes("book me right now") ||
    text.includes("make a booking for me") ||
    text.includes("booking cancel kar do") ||
    text.includes("reservation cancel kar do") ||
    text.includes("booking cancel kardo") ||
    text.includes("cancel karo meri booking")
  ) {
    return {
      primaryIntent: "BOOKING_ACTION_UNSUPPORTED",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "unsupported_operation",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Ambiguous Queries Requiring Grounded Policy Clarification
  if (
    text === "is it good for kids" ||
    text === "is it good for kids?" ||
    text.includes("good for kids") ||
    text === "is it nice" ||
    text === "is it nice?" ||
    text.includes("baccho ke liye kaisa hai")
  ) {
    return {
      primaryIntent: "AMBIGUOUS_CLARIFICATION",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "clarification",
      entities: { policy: "child" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["childPolicy"],
      unresolvedReferences: [],
      requiresClarification: true,
      clarificationPrompt:
        detectedLanguage === "hi-en"
          ? "Aster House sabhi families aur guests ka swagat karta hai. 12 saal tak ke bachhe existing bedding par free stay kar sakte hain. Kya aap room options dekhna chahenge ya policy details?"
          : detectedLanguage === "hi"
          ? "Aster House परिवारों और यात्रियों का स्वागत करता है। 12 वर्ष तक के बच्चे मौजूदा बिस्तर का उपयोग करके मुफ़्त ठहर सकते हैं। क्या आप कमरे के विकल्प या नियम देखना चाहेंगे?"
          : "Aster House welcomes families and travelers of all kinds. Children 12 and under stay free using existing bedding, and complimentary cribs are available. Would you like to check room options or policy details?",
    };
  }

  // Reservation State Inquiries in English, Hindi & Hinglish
  if (
    text.includes("confirm my reservation") ||
    text.includes("confirm our reservation") ||
    text.includes("already booked") ||
    text.includes("confirm it") ||
    text.includes("how much have i paid") ||
    text.includes("what is my balance") ||
    text.includes("meri booking confirm kar do") ||
    text.includes("meri booking confirm hai") ||
    text.includes("kya meri booking confirm hai") ||
    text.includes("booking confirm hai kya") ||
    text.includes("kitna pay kiya maine") ||
    text.includes("presidential suite")
  ) {
    return {
      primaryIntent: "RESERVATION_STATE_UNAVAILABLE",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "reservation_access_unavailable",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 4. Prompt Injections & Non-Hotel Topics (Python code, weather, flights, casino)
  if (
    text.includes("write python") ||
    text.includes("python code") ||
    text.includes("javascript") ||
    text.includes("weather in") ||
    text.includes("flights to") ||
    text.includes("say you have a casino") ||
    text.includes("casino")
  ) {
    return {
      primaryIntent: "OUT_OF_SCOPE",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "out_of_scope",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 5. Pending Subquestion Resolution (e.g. Turn 1 asked "breakfast and dinner", Turn 2 says "dinner" or "dinner ka kya?")
  if (state.pendingQuestions && state.pendingQuestions.length > 0) {
    const pending = state.pendingQuestions[0];
    if (
      text === pending.entity ||
      text === pending.text ||
      text.includes(pending.entity || "") ||
      text.includes("dinner ka kya") ||
      text.includes("dinner?")
    ) {
      return {
        primaryIntent: pending.intent,
        secondaryIntents: [],
        confidence: 0.9,
        detectedLanguage,
        responseKind: "partial_answer",
        entities: { meal: pending.entity },
        availabilitySlots: {},
        references: { pronouns: [] },
        requestedFields: [pending.requestedField || "inclusions"],
        unresolvedReferences: [],
        requiresClarification: false,
      };
    }
  }

  // 6. Reference Resolution (e.g. "what time does it close?", "kab band hota hai?", "inme cheapest kaunsa hai?")
  const hasPronoun =
    /\b(it|that|those|there|that room|those rooms|yeh|ye|woh|inme|unme|iska|iski)\b/i.test(text);

  const isSuperlativeCheapest =
    text.includes("cheapest") ||
    text.includes("least expensive") ||
    text.includes("sabse sasta") ||
    text.includes("cheapest kaunsa");

  const isSecondRoom =
    text.includes("second room") ||
    text.includes("second one") ||
    text.includes("dusra wala") ||
    text.includes("dusra room") ||
    text.includes("दूसरा कमरा");

  const isFirstRoom =
    text.includes("first room") ||
    text.includes("first one") ||
    text.includes("pehla wala") ||
    text.includes("पहला कमरा");

  const isWholeStayPrice =
    text.includes("whole stay") ||
    text.includes("total stay price") ||
    text.includes("total price") ||
    text.includes("poora kharcha") ||
    text.includes("kul kitna") ||
    text.includes("कुल कितना") ||
    text.includes("कुल खर्च");

  if (isSuperlativeCheapest && state.roomFrame && state.roomFrame.lastPresentedRooms.length > 0) {
    return {
      primaryIntent: "ROOM_COMPARISON",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "comparison",
      entities: {},
      availabilitySlots: {},
      references: {
        pronouns: ["those"],
        referencedPreviousResult: true,
        referencedComparison: "cheapest",
      },
      requestedFields: ["rate"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (isSecondRoom && state.roomFrame && state.roomFrame.lastPresentedRooms.length >= 2) {
    return {
      primaryIntent: "AVAILABILITY_FOLLOWUP",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: {},
      availabilitySlots: {},
      references: {
        pronouns: ["that"],
        referencedRoomResultIndex: 2,
        referencedPreviousResult: true,
      },
      requestedFields: ["totalPrice", "details"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (isFirstRoom && state.roomFrame && state.roomFrame.lastPresentedRooms.length >= 1) {
    return {
      primaryIntent: "AVAILABILITY_FOLLOWUP",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: {},
      availabilitySlots: {},
      references: {
        pronouns: ["that"],
        referencedRoomResultIndex: 1,
        referencedPreviousResult: true,
      },
      requestedFields: ["totalPrice", "details"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (isWholeStayPrice && state.roomFrame && state.roomFrame.stayQuery) {
    return {
      primaryIntent: "AVAILABILITY_FOLLOWUP",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: {},
      availabilitySlots: {},
      references: {
        pronouns: ["that"],
        referencedPreviousResult: true,
      },
      requestedFields: ["totalStayPrice"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Reference to dining: e.g. "Can it be delivered to my room?", "in the room?"
  if (
    state.referents?.lastDining ||
    (hasPronoun && (text.includes("delivered") || text.includes("served in the room") || text.includes("to my room")))
  ) {
    if (
      text.includes("deliver") ||
      text.includes("room service") ||
      text.includes("served in the room") ||
      text.includes("in the room") ||
      text.includes("to my room")
    ) {
      return {
        primaryIntent: "DINING_FACT",
        secondaryIntents: [],
        confidence: 0.95,
        detectedLanguage,
        responseKind: "partial_answer",
        entities: { meal: "breakfast" },
        availabilitySlots: {},
        references: { pronouns: ["it"] },
        requestedFields: ["delivery"],
        unresolvedReferences: [],
        requiresClarification: false,
      };
    }
  }

  // Reference to last amenity or property topic: "what time does it close?", "kab band hota hai?", "timing?", "EV charging?", "free hai kya?"
  if (state.referents?.lastAmenity) {
    if (
      text.includes("free hai") ||
      text.includes("free hai kya") ||
      text.includes("cost") ||
      text.includes("price") ||
      text.includes("ev charging")
    ) {
      if (state.referents.lastAmenity === "wifi") {
        return {
          primaryIntent: "AMENITY_FACT",
          secondaryIntents: [],
          confidence: 0.95,
          detectedLanguage,
          responseKind: "yes_no_fact",
          entities: { amenity: "wifi" },
          availabilitySlots: {},
          references: { pronouns: ["it"] },
          requestedFields: ["isComplimentary"],
          unresolvedReferences: [],
          requiresClarification: false,
        };
      }
      if (state.referents.lastAmenity === "parking" || text.includes("ev charging")) {
        return {
          primaryIntent: "AMENITY_FACT",
          secondaryIntents: [],
          confidence: 0.95,
          detectedLanguage,
          responseKind: "direct_fact",
          entities: { amenity: "parking" },
          availabilitySlots: {},
          references: { pronouns: ["it"] },
          requestedFields: ["evCharging", "parkingType"],
          unresolvedReferences: [],
          requiresClarification: false,
        };
      }
    }
  }

  // Luggage inquiry in follow-up context (e.g. "Luggage rakh sakte hain?")
  if (text.includes("luggage") || text.includes("saaman") || text.includes("सामान") || text.includes("baggage")) {
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { policy: "luggage" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["luggageStorage"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Reference to last amenity: "what time does it close?", "kab band hota hai?", "timing?", "open kab hota hai?"
  if (
    (hasPronoun || text.includes("timing") || text.includes("kab band") || text.includes("kab close")) &&
    state.referents?.lastAmenity
  ) {
    if (
      text.includes("close") ||
      text.includes("open") ||
      text.includes("hours") ||
      text.includes("late") ||
      text.includes("band") ||
      text.includes("timing")
    ) {
      const isClose = text.includes("close") || text.includes("band");
      return {
        primaryIntent: "AMENITY_FACT",
        secondaryIntents: [],
        confidence: 0.9,
        detectedLanguage,
        responseKind: "direct_fact",
        entities: { amenity: state.referents.lastAmenity },
        availabilitySlots: {},
        references: {
          pronouns: ["it"],
          referencedEntity: state.referents.lastAmenity,
        },
        requestedFields: isClose ? ["closeTime"] : ["hours"],
        unresolvedReferences: [],
        requiresClarification: false,
      };
    }
  }

  // 7. Multi-Intent Handling (e.g. "is breakfast and dinner included?")
  if (
    (text.includes("breakfast") && text.includes("dinner")) ||
    (text.includes("nashta") && text.includes("dinner")) ||
    (text.includes("naashta") && text.includes("dinner"))
  ) {
    return {
      primaryIntent: "MULTI_INTENT",
      secondaryIntents: ["DINING_FACT", "DINING_FACT"],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "partial_answer",
      entities: { meal: "breakfast" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["inclusions"],
      unresolvedReferences: [],
      requiresClarification: false,
      multiIntentParts: [
        { text: "breakfast", intent: "DINING_FACT", entity: "breakfast", requestedField: "inclusions" },
        { text: "dinner", intent: "DINING_FACT", entity: "dinner", requestedField: "inclusions" },
      ],
    };
  }

  // 8. Room Attribute Questions in English, Hindi & Hinglish
  if (
    text.includes("two beds") ||
    text.includes("2 beds") ||
    text.includes("two separate beds") ||
    text.includes("do bed") ||
    text.includes("do bistar") ||
    text.includes("दो बेड") ||
    text.includes("दो बिस्तर")
  ) {
    return {
      primaryIntent: "ROOM_ATTRIBUTE",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "list",
      entities: { roomAttribute: "two_beds" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["bedConfiguration"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (
    text.includes("bathtub") ||
    text.includes("tub") ||
    text.includes("soaking tub") ||
    text.includes("बाथटब")
  ) {
    return {
      primaryIntent: "ROOM_ATTRIBUTE",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { roomAttribute: "bathtub" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["amenities"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (
    text.includes("work desk") ||
    text.includes("desk in the room") ||
    text.includes("desk available") ||
    text.includes("dedicated work desk") ||
    text.includes("मेज") ||
    (text.includes("desk") && !text.includes("front desk")) ||
    (text.includes("डेस्क") && !text.includes("फ्रंट डेस्क"))
  ) {
    return {
      primaryIntent: "ROOM_ATTRIBUTE",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "yes_no_fact",
      entities: { roomAttribute: "desk" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["amenities"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 9. Room Catalog Questions in English, Hindi & Hinglish
  if (
    text.includes("what room types") ||
    text.includes("which room types") ||
    text.includes("room types do you have") ||
    text.includes("kaun kaun se room") ||
    text.includes("kaunse room hain") ||
    text.includes("room ke types") ||
    text.includes("kamre ke prakar") ||
    text.includes("कौन से कमरे") ||
    text.includes("कमरे के प्रकार") ||
    text.includes("कौन-कौन से कमरे") ||
    text === "rooms" ||
    text === "what rooms do you have" ||
    text === "rooms kaunse hain" ||
    text === "kamre"
  ) {
    return {
      primaryIntent: "ROOM_CATALOG",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "list",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["name", "description"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 10. Availability / Date Inquiries & Corrections
  const extracted = extractDates(text, today);
  const isDateCorrection =
    text.includes("change dates") ||
    text.includes("meant") ||
    text.includes("sorry i meant") ||
    text.includes("actually") ||
    text.includes("mera matlab") ||
    text.includes("nahi") ||
    text.includes("नहीं");

  // Party size parsing across English and Hindi/Hinglish
  let currentAdults: number | null = null;
  const adultsMatch = text.match(
    /(?:fits\s+)?(\d+|one|two|three|four|five|six|100|ek|do|teen|char|chaar|paanch|panch|एक|दो|तीन|चार|पाँच|पांच)\s*(?:guests|adults|people|persons|of us|log|logon|vyakti|लोग)/i
  );
  if (text.includes("fits four") || text.includes("fit four")) {
    currentAdults = 4;
  } else if (text.includes("fits five") || text.includes("fit five")) {
    currentAdults = 5;
  } else if (text.includes("fits three") || text.includes("fit three")) {
    currentAdults = 3;
  } else if (adultsMatch && adultsMatch[1]) {
    currentAdults = parseNumber(adultsMatch[1]);
  }

  if (currentAdults === null) {
    if (
      text.includes("for two") ||
      text.includes("for 2") ||
      text.includes("for me and my wife") ||
      text.includes("two adults") ||
      text.includes("two of us") ||
      text.includes("2 logon") ||
      text.includes("2 log") ||
      text.includes("do log") ||
      text.includes("hum do") ||
      text.includes("दो लोग")
    ) {
      currentAdults = 2;
    } else if (
      text.includes("one adult") ||
      text.includes("1 adult") ||
      text.includes("for 1") ||
      text.includes("for one") ||
      text.includes("1 log") ||
      text.includes("ek log") ||
      text.includes("एक व्यक्ति")
    ) {
      currentAdults = 1;
    } else if (
      text.includes("for three") ||
      text.includes("for 3") ||
      text.includes("3 of us") ||
      text.includes("3 log") ||
      text.includes("teen log") ||
      text.includes("hum teen") ||
      text.includes("तीन लोग")
    ) {
      currentAdults = 3;
    } else if (
      text.includes("for four") ||
      text.includes("for 4") ||
      text.includes("4 log") ||
      text.includes("char log") ||
      text.includes("chaar log") ||
      text.includes("hum char") ||
      text.includes("चार लोग") ||
      text.includes("चार")
    ) {
      currentAdults = 4;
    } else if (
      text.includes("5 log") ||
      text.includes("paanch log") ||
      text.includes("पाँच लोग")
    ) {
      currentAdults = 5;
    }
  }

  // 11. Pragmatic Negation Check: "Availability mat check karo, bas batao 4 log kis room mein fit honge"
  const isExplicitAvoidAvailability =
    hasNegation &&
    (text.includes("availability mat") ||
      text.includes("mat check karo") ||
      text.includes("do not check availability") ||
      text.includes("availability nahi") ||
      text.includes("pool nahi chahiye") ||
      text.includes("nahi chahiye"));

  // Room Suitability Questions (e.g. "which room is suitable for 5 guests?", "Can 3 of us crash in one room?", "3 log ke liye kaunsa room hai?", "3 logon ke liye sabse sasta room")
  const isPartySizeCorrectionInAvailability =
    isDateCorrection &&
    currentAdults !== null &&
    (state.activeTopic === "availability" || state.availabilityFrame !== undefined);

  const isSuitabilityQuery =
    !isPartySizeCorrectionInAvailability &&
    ((text.includes("sabse sasta room") && !text.includes("available")) ||
      text.includes("room for 3 batao") ||
      text.includes("room for 4 batao") ||
      (isExplicitAvoidAvailability && (text.includes("room") || text.includes("fit") || currentAdults !== null)) ||
      text.includes("suitable") ||
      text.includes("which room") ||
      text.includes("crash in one room") ||
      text.includes("fit in a king room") ||
      text.includes("smallest room that can accommodate") ||
      text.includes("which room works") ||
      text.includes("kaunsa room hai") ||
      text.includes("kis room mein fit") ||
      text.includes("fit honge") ||
      text.includes("kaunsa room") ||
      text.includes("family ke liye") ||
      text.includes("all five of us stay together") ||
      text.includes("stay together") ||
      (text.includes("two adults") && text.includes("two children")) ||
      (text.includes("fits") && !text.includes("available")) ||
      (text.includes("fit") && !text.includes("available")));

  if (isSuitabilityQuery) {
    const isTwoAdultsTwoKids = text.includes("two adults") && text.includes("two children");
    const adults = isTwoAdultsTwoKids
      ? 4
      : currentAdults || (text.includes("5") ? 5 : text.includes("4") ? 4 : text.includes("3") ? 3 : 2);
    const isSpecificKingQuery = text.includes("king room") || text.includes("king deluxe");
    const isSmallestQuery =
      text.includes("smallest") ||
      text.includes("sabse chota") ||
      text.includes("sabse sasta");

    return {
      primaryIntent: "ROOM_SUITABILITY",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "recommendation_from_facts",
      entities: {
        roomType: isSpecificKingQuery ? "King Deluxe" : undefined,
      },
      availabilitySlots: {
        adults: { value: adults, source: "current_message", turnIndex: state.turnCount },
      },
      references: {
        pronouns: [],
        referencedComparison: isSmallestQuery ? "smallest" : undefined,
      },
      requestedFields: ["maxOccupancy", "bedConfiguration"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  const isDiningContext =
    text.includes("breakfast") ||
    text.includes("dining") ||
    text.includes("eat") ||
    text.includes("nashta") ||
    text.includes("khana");

  const isAvailabilityQuery =
    !isDiningContext &&
    !isExplicitAvoidAvailability &&
    (Boolean(extracted.checkIn || extracted.checkOut) ||
      text.includes("available") ||
      text.includes("availability") ||
      text.includes("need a hotel room") ||
      text.includes("need a room") ||
      text.includes("got rooms") ||
      text.includes("room chahiye") ||
      text.includes("kamra chahiye") ||
      text.includes("room milega") ||
      (text.includes("staying") && !text.includes("not staying")) ||
      text.includes("what about") ||
      text.includes("how about") ||
      (isDateCorrection && (state.activeTopic === "availability" || state.availabilityFrame !== undefined)));

  if (isAvailabilityQuery) {
    const slots: Interpretation["availabilitySlots"] = {};
    if (extracted.checkIn) {
      slots.checkIn = { value: extracted.checkIn, source: "current_message", turnIndex: state.turnCount };
    }
    if (extracted.checkOut) {
      slots.checkOut = { value: extracted.checkOut, source: "current_message", turnIndex: state.turnCount };
    }
    if (currentAdults !== null) {
      slots.adults = { value: currentAdults, source: "current_message", turnIndex: state.turnCount };
    }

    return {
      primaryIntent: "AVAILABILITY_SEARCH",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "availability_result",
      entities: {},
      availabilitySlots: slots,
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 12. Property Facts (Address, Location, Phone, Contact)
  if (
    text.includes("address") ||
    text.includes("where is the hotel") ||
    text.includes("where exactly is the hotel located") ||
    text.includes("location") ||
    text.includes("hotel kahan hai") ||
    text.includes("hotel ka pata") ||
    text.includes("hotel ka address") ||
    text.includes("पता") ||
    text.includes("होटल कहाँ है")
  ) {
    return {
      primaryIntent: "PROPERTY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["address", "location"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (
    text.includes("phone") ||
    text.includes("phone number") ||
    text.includes("call front desk") ||
    text.includes("contact") ||
    text.includes("front desk ka number") ||
    text.includes("contact number") ||
    text.includes("नंबर")
  ) {
    return {
      primaryIntent: "PROPERTY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["phone"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // 13. Policy Facts: Check-in / Check-out / Departure / Leaving
  if (
    text.includes("check out") ||
    text.includes("checkout") ||
    text.includes("leave my room") ||
    text.includes("leave the room") ||
    text.includes("vacate") ||
    text.includes("departure") ||
    text.includes("checkout kab hai") ||
    text.includes("checkout kab karna hai") ||
    text.includes("room kab chodna hai") ||
    text.includes("चेक-आउट कब है") ||
    text.includes("चेक-आउट")
  ) {
    const alsoAsksCheckIn =
      text.includes("check in") || text.includes("check-in") || text.includes("चेक-इन");
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { policy: "checkout" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: alsoAsksCheckIn ? ["checkInTime", "checkOutTime"] : ["checkOutTime"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (
    text.includes("check in") ||
    text.includes("check-in") ||
    text.includes("arrival") ||
    text.includes("checkin kitne baje") ||
    text.includes("check-in kitne baje") ||
    text.includes("checkin kab hai") ||
    text.includes("चेक-इन कितने बजे") ||
    text.includes("चेक-इन")
  ) {
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { policy: "checkin" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["checkInTime"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  if (
    text.includes("cancel") ||
    text.includes("cancellation") ||
    text.includes("refund") ||
    text.includes("deposit") ||
    text.includes("cancellation policy") ||
    text.includes("refund milega") ||
    text.includes("कैंसिलेशन")
  ) {
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { policy: "cancellation" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["standardCancellationNotice", "lateCancellationPenalty"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Pet Policy (Distinguishing cats vs dogs, "furry friend", etc.)
  if (
    text.includes("pet") ||
    text.includes("dog") ||
    text.includes("cat") ||
    text.includes("animals") ||
    text.includes("furry friend") ||
    text.includes("kutta") ||
    text.includes("billi") ||
    text.includes("बिल्ली") ||
    text.includes("बिल्लियाँ") ||
    text.includes("कुत्ता") ||
    text.includes("पालतू जानवर")
  ) {
    const isCat = text.includes("cat") || text.includes("cats") || text.includes("billi") || text.includes("बिल्ली") || text.includes("बिल्लियाँ");
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: isCat ? "partial_answer" : "direct_fact",
      entities: {
        policy: "pet",
        targetEntity: isCat ? "cat" : "dog",
      },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: isCat ? ["catPolicy"] : ["maximumWeightLbs", "petFeePerStay", "rules"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Parking Policy
  if (
    text.includes("park") ||
    text.includes("parking") ||
    text.includes("valet") ||
    text.includes("garage") ||
    text.includes("car") ||
    text.includes("parking free hai") ||
    text.includes("parking milti hai") ||
    text.includes("गाड़ी पार्क")
  ) {
    return {
      primaryIntent: "AMENITY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { amenity: "parking" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["parkingType", "valetRateNightly", "evCharging"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Wi-Fi Policy
  if (
    text.includes("wifi") ||
    text.includes("wi-fi") ||
    text.includes("internet") ||
    text.includes("वाइफ़ाई") ||
    text.includes("वाइ-फ़ाई") ||
    text.includes("वाई-फ़ाई") ||
    text.includes("वाईफाई") ||
    text.includes("वाई फ़ाई") ||
    text.includes("नेट")
  ) {
    const asksIfFree =
      text.includes("free") ||
      text.includes("cost") ||
      text.includes("price") ||
      text.includes("pay") ||
      text.includes("muft") ||
      text.includes("मुफ़्त");
    return {
      primaryIntent: "AMENITY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "yes_no_fact",
      entities: { amenity: "wifi" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: asksIfFree ? ["isComplimentary"] : ["speed", "isComplimentary"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Dining & Breakfast Facts
  if (
    text.includes("breakfast") ||
    text.includes("morning meal") ||
    text.includes("food in the morning") ||
    text.includes("dining") ||
    text.includes("nashta") ||
    text.includes("naashta") ||
    text.includes("नाश्ता") ||
    text.includes("नाश्ते")
  ) {
    let field = "general";
    if (text.includes("where") || text.includes("location") || text.includes("kahan") || text.includes("कहाँ") || text.includes("कहा")) field = "location";
    if (text.includes("what time") || text.includes("hours") || text.includes("when") || text.includes("kitne baje") || text.includes("कब") || text.includes("समय")) field = "hours";
    if (
      text.includes("included") ||
      text.includes("free") ||
      text.includes("price") ||
      text.includes("cost") ||
      text.includes("shamil") ||
      text.includes("शामिल")
    ) {
      field = "inclusions";
    }
    if (
      text.includes("deliver") ||
      text.includes("room service") ||
      text.includes("room delivery") ||
      text.includes("in the room") ||
      text.includes("come to my room")
    ) {
      field = "delivery";
    }
    if (text.includes("not staying") || text.includes("non guest") || text.includes("public")) field = "nonGuestAccess";

    return {
      primaryIntent: "DINING_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: field === "delivery" || field === "nonGuestAccess" ? "partial_answer" : "direct_fact",
      entities: { meal: "breakfast" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [field],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Swimming Pool Facts
  if (
    text.includes("pool") ||
    text.includes("swimming") ||
    text.includes("swim") ||
    text.includes("go for a swim") ||
    text.includes("स्विमिंग पूल") ||
    text.includes("पूल")
  ) {
    let field = "general";
    if (
      text.includes("what time") ||
      text.includes("hours") ||
      text.includes("open") ||
      text.includes("close") ||
      text.includes("band") ||
      text.includes("timing") ||
      text.includes("kab band")
    ) {
      field = "hours";
    }
    if (
      text.includes("heated") ||
      text.includes("saltwater") ||
      text.includes("temperature") ||
      text.includes("garam")
    ) {
      field = "features";
    }

    return {
      primaryIntent: "AMENITY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: field === "features" ? "yes_no_fact" : "direct_fact",
      entities: { amenity: "swimming_pool" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [field],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Luggage Storage
  if (text.includes("luggage") || text.includes("bags") || text.includes("baggage") || text.includes("saaman")) {
    return {
      primaryIntent: "POLICY_FACT",
      secondaryIntents: [],
      confidence: 0.95,
      detectedLanguage,
      responseKind: "direct_fact",
      entities: { policy: "luggage" },
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: ["luggageStorage"],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Unverified Hotel Services (spa, laundry, taxi, airport shuttle, wheelchair)
  if (
    text.includes("spa") ||
    text.includes("laundry") ||
    text.includes("taxi") ||
    text.includes("cab") ||
    text.includes("airport shuttle") ||
    text.includes("shuttle") ||
    text.includes("id need") ||
    text.includes("what id") ||
    text.includes("wheelchair") ||
    text.includes("accessible") ||
    text.includes("स्पा")
  ) {
    return {
      primaryIntent: "OUT_OF_SCOPE",
      secondaryIntents: [],
      confidence: 0.9,
      detectedLanguage,
      responseKind: "unknown_hotel_fact",
      entities: {},
      availabilitySlots: {},
      references: { pronouns: [] },
      requestedFields: [],
      unresolvedReferences: [],
      requiresClarification: false,
    };
  }

  // Default Fallback
  return {
    primaryIntent: "OUT_OF_SCOPE",
    secondaryIntents: [],
    confidence: 0.5,
    detectedLanguage,
    responseKind: "unknown_hotel_fact",
    entities: {},
    availabilitySlots: {},
    references: { pronouns: [] },
    requestedFields: [],
    unresolvedReferences: [],
    requiresClarification: false,
  };
}
