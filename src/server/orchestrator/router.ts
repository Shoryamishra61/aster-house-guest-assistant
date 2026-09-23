import {
  ChatResponse,
  LLMClient,
  SessionState,
  SessionStore,
} from "../../shared/contracts";
import {
  checkAvailability,
  findSuitableRooms,
  mergeAvailabilitySlots,
  validateAvailabilityQuery,
  DomainValidationError,
} from "../domain/availability";
import { HOTEL_INFO, KNOWLEDGE_BASE } from "../data/hotelData";
import { retrieveKnowledge } from "../retrieval/retriever";
import { verifyGroundedAnswer } from "../retrieval/verifier";
import { hashSessionId, logger } from "../observability/logger";
import { MockLLMClient } from "../llm/mockClient";
import { RealLLMClient } from "../llm/realClient";
import { InMemorySessionStore } from "../session/store";
import { ScopedConversationState } from "../conversation/contracts";
import { interpretMessage } from "../conversation/semanticInterpreter";
import { buildAnswerPlan } from "../conversation/answerPlanner";

export type ChatInput = {
  requestId: string;
  sessionId?: string;
  message: string;
  availability?: {
    checkIn?: string;
    checkOut?: string;
    adults?: number;
  };
};

export class ChatOrchestrator {
  private llm: LLMClient;
  private sessionStore: SessionStore;

  constructor(options?: {
    llm?: LLMClient;
    sessionStore?: SessionStore;
  }) {
    if (options?.llm) {
      this.llm = options.llm;
    } else {
      const mode = process.env.LLM_MODE || (process.env.MOCK_LLM === "false" ? "real" : "mock");
      this.llm = mode === "real" ? new RealLLMClient() : new MockLLMClient();
    }
    this.sessionStore = options?.sessionStore || new InMemorySessionStore();
  }

  async handleMessage(input: ChatInput): Promise<ChatResponse> {
    const startTime = Date.now();
    const requestId = input.requestId;
    const sessionId = input.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sessionIdHash = hashSessionId(sessionId);

    let llmCalls = 0;
    let toolCalls = 0;
    let route = "unknown";
    let intentName = "unknown";
    let isFallback = false;
    let errorCode: string | null = null;

    try {
      // 1. Load or initialize session state
      let session = await this.sessionStore.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          history: [],
          availabilitySlots: {},
          updatedAt: Date.now(),
        };
      }

      // Initialize or restore scoped conversation state
      const scopedState: ScopedConversationState = session.scopedState || {
        turnCount: 0,
        activeTopic: undefined,
        availabilityFrame: undefined,
        roomFrame: undefined,
        referents: undefined,
        pendingQuestions: [],
      };
      scopedState.turnCount = (scopedState.turnCount || 0) + 1;

      const today = new Date().toISOString().slice(0, 10);

      // 2. Interpret incoming user message semantically with referent resolution & slot scoping
      const interpretation = interpretMessage(input.message, scopedState, today);
      scopedState.lastLanguage = interpretation.detectedLanguage;
      const isExplicitFormSubmission = Boolean(
        input.availability?.checkIn && input.availability?.checkOut && input.availability?.adults
      );

      // 3. Pre-routing: If explicit availability form was submitted from UI
      if (isExplicitFormSubmission) {
        route = "availability_tool";
        intentName = "availability";

        try {
          const validQuery = validateAvailabilityQuery(
            {
              checkIn: input.availability!.checkIn!,
              checkOut: input.availability!.checkOut!,
              adults: input.availability!.adults!,
            },
            { today }
          );

          toolCalls++;
          const result = checkAvailability(validQuery.checkIn, validQuery.checkOut, validQuery.adults, { today });

          // Update scoped room frame and availability frame
          scopedState.activeTopic = "availability";
          scopedState.availabilityFrame = {
            checkIn: { value: validQuery.checkIn, source: "structured_form", turnIndex: scopedState.turnCount },
            checkOut: { value: validQuery.checkOut, source: "structured_form", turnIndex: scopedState.turnCount },
            adults: { value: validQuery.adults, source: "structured_form", turnIndex: scopedState.turnCount },
            createdTurn: scopedState.turnCount,
            lastUpdatedTurn: scopedState.turnCount,
            status: "completed",
          };
          scopedState.roomFrame = {
            lastPresentedRooms: result.rooms.map((r) => ({
              roomTypeId: r.roomTypeId,
              name: r.name,
              nightlyRate: r.nightlyRate,
              totalPrice: r.totalPrice,
              maxOccupancy: r.maxOccupancy,
              bedConfiguration: r.bedConfiguration,
              amenities: r.amenities,
            })),
            stayQuery: {
              checkIn: validQuery.checkIn,
              checkOut: validQuery.checkOut,
              adults: validQuery.adults,
              nights: result.query.nights,
            },
            createdTurn: scopedState.turnCount,
          };
          scopedState.referents = {
            lastTopic: "availability",
            turnIndex: scopedState.turnCount,
          };

          session.availabilitySlots = {
            checkIn: validQuery.checkIn,
            checkOut: validQuery.checkOut,
            adults: validQuery.adults,
          };

          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          const replyMessage =
            result.rooms.length > 0
              ? `Found ${result.rooms.length} room option${result.rooms.length > 1 ? "s" : ""} for ${result.query.nights} night${result.query.nights > 1 ? "s" : ""} (${validQuery.checkIn} to ${validQuery.checkOut}, ${validQuery.adults} guest${validQuery.adults > 1 ? "s" : ""}):`
              : `No rooms match those dates for ${validQuery.adults} adult${validQuery.adults > 1 ? "s" : ""}. Try different dates or contact our front desk at ${HOTEL_INFO.phone}.`;

          session.history.push({ role: "assistant", text: replyMessage, timestamp: Date.now() });
          session.lastIntent = "availability";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "availability_result",
            message: replyMessage,
            query: result.query,
            rooms: result.rooms,
          };
        } catch (err: unknown) {
          if (err instanceof DomainValidationError) {
            errorCode = err.code;
            return {
              requestId,
              sessionId,
              type: "error",
              message: err.message,
              retryable: false,
            };
          }
          throw err;
        }
      }

      // 4. Validate LLM health / check for timeout simulation (EV-14)
      llmCalls++;
      let intentResult = await this.llm
        .classifyIntent({
          message: input.message,
          today,
          existingSlots: session.availabilitySlots,
          history: session.history,
        })
        .catch((err) => {
          logger.warn({
            event: "intent_classification_failed",
            requestId,
            sessionIdHash,
            details: { error: String(err) },
          });
          return null;
        });

      if (!intentResult) {
        errorCode = "LLM_TIMEOUT";
        isFallback = true;
        return {
          requestId,
          sessionId,
          type: "fallback",
          message: `I couldn't process your request right now. You can check room availability below or call our front desk directly at ${HOTEL_INFO.phone}.`,
          reason: "model_unavailable",
        };
      }

      // 4. Handle Semantic Intent Routing
      intentName = interpretation.primaryIntent;

      // 4a. Security Refusal
      if (interpretation.primaryIntent === "SECURITY_REFUSAL") {
        route = "security_refusal";
        const plan = buildAnswerPlan(interpretation, scopedState);
        const reply = plan.customMessage || "I cannot provide credentials, system instructions, or private guest information.";

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: reply, timestamp: Date.now() });
        session.lastIntent = "out_of_scope";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "fallback",
          message: reply,
          reason: "unsupported",
        };
      }

      // 4b. Booking Action / Reservation State Unavailable / Human Escalation
      if (
        interpretation.primaryIntent === "BOOKING_ACTION_UNSUPPORTED" ||
        interpretation.primaryIntent === "RESERVATION_STATE_UNAVAILABLE" ||
        interpretation.primaryIntent === "HUMAN_ESCALATION"
      ) {
        route = interpretation.primaryIntent === "HUMAN_ESCALATION" ? "human_escalation" : "booking_action_refusal";
        const plan = buildAnswerPlan(interpretation, scopedState);
        const reply = plan.customMessage!;

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: reply, timestamp: Date.now() });
        session.lastIntent = "out_of_scope";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "fallback",
          message: reply,
          reason: "unsupported",
        };
      }

      // 4c. Out of Scope / Unverified Service
      if (interpretation.primaryIntent === "OUT_OF_SCOPE") {
        route = "out_of_scope_fallback";
        isFallback = true;
        const plan = buildAnswerPlan(interpretation, scopedState);
        const reply = plan.customMessage!;

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: reply, timestamp: Date.now() });
        session.lastIntent = "out_of_scope";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "fallback",
          message: reply,
          reason: "unsupported",
        };
      }

      // 4c-2. Ambiguous Clarification
      if (interpretation.primaryIntent === "AMBIGUOUS_CLARIFICATION") {
        route = "ambiguous_clarify";
        const reply = interpretation.clarificationPrompt ||
          "Aster House welcomes families and travelers of all kinds. Children 12 and under stay free using existing bedding, and complimentary cribs are available. Would you like to check room options or policy details?";

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: reply, timestamp: Date.now() });
        session.lastIntent = "ambiguous";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "fallback",
          message: reply,
          reason: "ambiguous",
        };
      }

      // 4d. Room Comparison (e.g. "Which of those rooms is cheapest?")
      if (interpretation.primaryIntent === "ROOM_COMPARISON" || interpretation.primaryIntent === "AVAILABILITY_FOLLOWUP") {
        route = "room_comparison";
        const plan = buildAnswerPlan(interpretation, scopedState);
        if (plan.customMessage) {
          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: plan.customMessage, timestamp: Date.now() });
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "answer",
            message: plan.customMessage,
            sources: plan.facts.map((f) => ({ id: f.sourceId, label: f.sourceId })),
          };
        }
      }

      // 4e. Room Catalog Questions ("What room types do you have?")
      if (interpretation.primaryIntent === "ROOM_CATALOG") {
        route = "room_catalog";
        const plan = buildAnswerPlan(interpretation, scopedState);
        const reply = plan.customMessage!;

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: reply, timestamp: Date.now() });
        session.lastIntent = "room_catalog";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "answer",
          message: reply,
          sources: [{ id: "room_catalog", label: "Aster House Room Catalog" }],
        };
      }

      // 4f. Room Attribute Questions ("Which rooms have two beds?", "Does the room have a desk?")
      if (interpretation.primaryIntent === "ROOM_ATTRIBUTE") {
        route = "room_attribute";
        const plan = buildAnswerPlan(interpretation, scopedState);
        if (plan.customMessage) {
          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: plan.customMessage, timestamp: Date.now() });
          session.lastIntent = "room_attribute";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "answer",
            message: plan.customMessage,
            sources: [{ id: "rooms_data", label: "Room Specifications" }],
          };
        }
      }

      // 4g. Room Suitability ("Which room is suitable for 5 guests?", "Can four guests fit in a king room?")
      if (interpretation.primaryIntent === "ROOM_SUITABILITY") {
        route = "room_suitability";
        const adults = interpretation.availabilitySlots.adults?.value || 2;

        const plan = buildAnswerPlan(interpretation, scopedState);
        if (plan.customMessage) {
          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: plan.customMessage, timestamp: Date.now() });
          session.lastIntent = "room_suitability";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "answer",
            message: plan.customMessage,
            sources: [{ id: "rooms_data", label: "Room Specifications" }],
          };
        }

        const suitable = findSuitableRooms(adults);
        const roomResults = suitable.map((r) => ({
          roomTypeId: r.id,
          name: r.name,
          maxOccupancy: r.maxOccupancy,
          bedConfiguration: r.bedConfiguration,
          nightlyRate: r.baseRate,
          currency: "USD" as const,
          nights: 1,
          totalPrice: r.baseRate,
          amenities: r.amenities,
        }));

        scopedState.activeTopic = "room_suitability";
        scopedState.roomFrame = {
          lastPresentedRooms: roomResults,
          createdTurn: scopedState.turnCount,
        };

        const replyMessage =
          roomResults.length > 0
            ? `For ${adults} guest${adults > 1 ? "s" : ""}, the following room types provide suitable capacity (dates needed to confirm live availability):`
            : `We do not have single rooms accommodating ${adults} guests. Please contact the front desk at ${HOTEL_INFO.phone} for multi-room arrangements.`;

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: replyMessage, timestamp: Date.now() });
        session.lastIntent = "room_suitability";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "room_suitability",
          message: replyMessage,
          rooms: roomResults,
        };
      }

      // 4h. Availability Search & Followup (HARD ISOLATION: No Stale Slot Leakage)
      if (interpretation.primaryIntent === "AVAILABILITY_SEARCH") {
        route = "availability_tool";

        // Determine if this is an explicit new search or continuation
        const msgSlots = interpretation.availabilitySlots;
        const currentFrame = scopedState.availabilityFrame;

        // HARD INVARIANT: If the current message provides new dates, NEVER reuse old dates
        let checkIn = msgSlots.checkIn?.value;
        let checkOut = msgSlots.checkOut?.value;
        let adults = msgSlots.adults?.value;

        // If user changed dates (e.g. "Sorry I meant October 20-22"), reuse guests ONLY if within active availability flow (<2 turns)
        const isFollowUpWithinActiveFlow =
          currentFrame &&
          scopedState.activeTopic === "availability" &&
          scopedState.turnCount - currentFrame.lastUpdatedTurn <= 2;

        if (!checkIn && isFollowUpWithinActiveFlow && currentFrame?.checkIn) {
          checkIn = currentFrame.checkIn.value;
        }
        if (!checkOut && isFollowUpWithinActiveFlow && currentFrame?.checkOut) {
          checkOut = currentFrame.checkOut.value;
        }
        if (adults === undefined && isFollowUpWithinActiveFlow && currentFrame?.adults) {
          adults = currentFrame.adults.value;
        }

        // If any slots are missing, return needs_input without guessing or leaking ancient state
        const missingFields: Array<"checkIn" | "checkOut" | "adults"> = [];
        if (!checkIn) missingFields.push("checkIn");
        if (!checkOut) missingFields.push("checkOut");
        if (adults === undefined || adults === null) missingFields.push("adults");

        // If party size exceeds maximum room capacity (e.g. 100 guests), return explicit notification
        if (adults && adults > 10) {
          const limitMsg =
            "Party size exceeds single room limit (maximum 5 guests per room). For group reservations of 6 or more guests, please contact our front desk at +1 (555) 328-9100.";
          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: limitMsg, timestamp: Date.now() });
          session.lastIntent = "availability";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "needs_input",
            message: limitMsg,
            missingFields: ["adults"],
            currentValues: {
              adults,
            },
          };
        }

        if (missingFields.length > 0) {
          const promptMsg =
            missingFields.length === 3
              ? "Please provide your check-in date, check-out date, and number of guests to check availability."
              : `Please provide your ${missingFields.map((f) => (f === "checkIn" ? "check-in date" : f === "checkOut" ? "check-out date" : "number of guests")).join(" and ")} to check availability.`;

          // Update active availability frame with partial values
          scopedState.activeTopic = "availability";
          scopedState.availabilityFrame = {
            checkIn: checkIn ? { value: checkIn, source: "current_message", turnIndex: scopedState.turnCount } : undefined,
            checkOut: checkOut ? { value: checkOut, source: "current_message", turnIndex: scopedState.turnCount } : undefined,
            adults: adults !== undefined ? { value: adults, source: "current_message", turnIndex: scopedState.turnCount } : undefined,
            createdTurn: currentFrame?.createdTurn || scopedState.turnCount,
            lastUpdatedTurn: scopedState.turnCount,
            status: "active",
          };

          session.availabilitySlots = {
            checkIn: checkIn || null,
            checkOut: checkOut || null,
            adults: adults || null,
          };

          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: promptMsg, timestamp: Date.now() });
          session.lastIntent = "availability";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "needs_input",
            message: promptMsg,
            missingFields,
            currentValues: {
              checkIn: checkIn || undefined,
              checkOut: checkOut || undefined,
              adults: adults !== undefined ? adults : undefined,
            },
          };
        }

        // All 3 slots present => validate and call deterministic availability
        try {
          const validQuery = validateAvailabilityQuery(
            { checkIn: checkIn!, checkOut: checkOut!, adults: adults! },
            { today }
          );

          toolCalls++;
          const result = checkAvailability(validQuery.checkIn, validQuery.checkOut, validQuery.adults, { today });

          // Update scoped frame
          scopedState.activeTopic = "availability";
          scopedState.availabilityFrame = {
            checkIn: { value: validQuery.checkIn, source: "current_message", turnIndex: scopedState.turnCount },
            checkOut: { value: validQuery.checkOut, source: "current_message", turnIndex: scopedState.turnCount },
            adults: { value: validQuery.adults, source: "current_message", turnIndex: scopedState.turnCount },
            createdTurn: scopedState.turnCount,
            lastUpdatedTurn: scopedState.turnCount,
            status: "completed",
          };
          scopedState.roomFrame = {
            lastPresentedRooms: result.rooms.map((r) => ({
              roomTypeId: r.roomTypeId,
              name: r.name,
              nightlyRate: r.nightlyRate,
              totalPrice: r.totalPrice,
              maxOccupancy: r.maxOccupancy,
              bedConfiguration: r.bedConfiguration,
              amenities: r.amenities,
            })),
            stayQuery: {
              checkIn: validQuery.checkIn,
              checkOut: validQuery.checkOut,
              adults: validQuery.adults,
              nights: result.query.nights,
            },
            createdTurn: scopedState.turnCount,
          };

          session.availabilitySlots = {
            checkIn: validQuery.checkIn,
            checkOut: validQuery.checkOut,
            adults: validQuery.adults,
          };

          const replyMessage =
            result.rooms.length > 0
              ? `Found ${result.rooms.length} available room option${result.rooms.length > 1 ? "s" : ""} for ${result.query.nights} night${result.query.nights > 1 ? "s" : ""} (${validQuery.checkIn} to ${validQuery.checkOut}, ${validQuery.adults} guest${validQuery.adults > 1 ? "s" : ""}):`
              : `No rooms match those dates for ${validQuery.adults} adult${validQuery.adults > 1 ? "s" : ""}. Try different dates or contact our front desk at ${HOTEL_INFO.phone}.`;

          session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
          session.history.push({ role: "assistant", text: replyMessage, timestamp: Date.now() });
          session.lastIntent = "availability";
          session.scopedState = scopedState;
          await this.sessionStore.save(session);

          return {
            requestId,
            sessionId,
            type: "availability_result",
            message: replyMessage,
            query: result.query,
            rooms: result.rooms,
          };
        } catch (err: unknown) {
          if (err instanceof DomainValidationError) {
            console.error("DEBUG DomainValidationError:", err.code, err.message);
            errorCode = err.code;
            return {
              requestId,
              sessionId,
              type: "error",
              message: err.message,
              retryable: false,
            };
          }
          throw err;
        }
      }

      // 4i. Factual Inquiries (PROPERTY_FACT, POLICY_FACT, AMENITY_FACT, DINING_FACT, MULTI_INTENT)
      // Switch active topic and record referents
      if (interpretation.entities.amenity) {
        scopedState.referents = {
          ...scopedState.referents,
          lastAmenity: interpretation.entities.amenity,
          lastTopic: "amenity",
          turnIndex: scopedState.turnCount,
        };
      }
      if (interpretation.entities.policy) {
        scopedState.referents = {
          ...scopedState.referents,
          lastPolicy: interpretation.entities.policy,
          lastTopic: "policy",
          turnIndex: scopedState.turnCount,
        };
      }
      if (interpretation.entities.meal || interpretation.primaryIntent === "DINING_FACT") {
        scopedState.referents = {
          ...scopedState.referents,
          lastDining: interpretation.entities.meal || "breakfast",
          lastTopic: "property",
          turnIndex: scopedState.turnCount,
        };
      }
      scopedState.activeTopic = "property";

      // If multi-intent query has an unresolved secondary part (e.g. dinner in "breakfast and dinner"), save to pending questions
      if (interpretation.multiIntentParts && interpretation.multiIntentParts.length > 1) {
        const secondary = interpretation.multiIntentParts.slice(1);
        scopedState.pendingQuestions = secondary;
      } else {
        scopedState.pendingQuestions = [];
      }

      // Build Answer Plan
      const plan = buildAnswerPlan(interpretation, scopedState);

      if (plan.customMessage) {
        // Collect exact matching sources
        const sources = plan.facts.map((f) => {
          const kbItem = KNOWLEDGE_BASE.find((k) => k.id === f.sourceId);
          return { id: f.sourceId, label: kbItem ? kbItem.title : f.sourceId };
        });

        // Deduplicate sources
        const uniqueSources = Array.from(new Map(sources.map((s) => [s.id, s])).values());

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: plan.customMessage, timestamp: Date.now() });
        session.lastIntent = "knowledge";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "answer",
          message: plan.customMessage,
          sources: uniqueSources,
        };
      }

      // Fall back to knowledge retrieval for general questions
      route = "knowledge_retrieval";
      const retrieved = retrieveKnowledge(input.message, 1); // Top-1 precision to prevent irrelevant source dumping

      if (retrieved.length === 0) {
        isFallback = true;
        const noMatchMsg =
          `I don't have verified information regarding that in the Aster House records. Our front desk team is happy to assist at ${HOTEL_INFO.phone}.`;

        session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
        session.history.push({ role: "assistant", text: noMatchMsg, timestamp: Date.now() });
        session.lastIntent = "knowledge";
        session.scopedState = scopedState;
        await this.sessionStore.save(session);

        return {
          requestId,
          sessionId,
          type: "fallback",
          message: noMatchMsg,
          reason: "unsupported",
        };
      }

      // Prepare facts for grounded generation
      const factsForModel = retrieved.map((r) => ({
        id: r.item.id,
        title: r.item.title,
        text: r.item.summary,
      }));

      llmCalls++;
      let answerResult = await this.llm
        .generateGroundedAnswer({
          message: input.message,
          facts: factsForModel,
        })
        .catch(() => null);

      const verification = answerResult
        ? verifyGroundedAnswer(answerResult, retrieved.map((r) => r.item))
        : { isValid: false, reason: "Model generation failed or timed out" };

      let finalReply: string;
      const sources = retrieved.map((r) => ({ id: r.item.id, label: r.item.title }));

      if (verification.isValid && answerResult) {
        finalReply = answerResult.reply;
      } else {
        finalReply = retrieved[0].item.summary;
      }

      session.history.push({ role: "user", text: input.message, timestamp: Date.now() });
      session.history.push({ role: "assistant", text: finalReply, timestamp: Date.now() });
      session.lastIntent = "knowledge";
      session.scopedState = scopedState;
      await this.sessionStore.save(session);

      return {
        requestId,
        sessionId,
        type: "answer",
        message: finalReply,
        sources,
      };
    } catch (error: unknown) {
      errorCode = "INTERNAL_ERROR";
      const msg = error instanceof Error ? error.message : "An unexpected service error occurred";
      logger.error({
        event: "chat_orchestrator_error",
        requestId,
        sessionIdHash,
        errorCode,
        details: { message: msg },
      });

      return {
        requestId,
        sessionId,
        type: "error",
        message: "We encountered an issue processing your request. Please try again or reach our front desk.",
        retryable: true,
      };
    } finally {
      const latencyMs = Date.now() - startTime;
      logger.info({
        event: "chat_request_completed",
        requestId,
        sessionIdHash,
        intent: intentName,
        route,
        latencyMs,
        llmCalls,
        toolCalls,
        fallback: isFallback,
        errorCode,
      });
    }
  }
}
