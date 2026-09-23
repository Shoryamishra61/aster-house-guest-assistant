/**
 * Aster House Guest Assistant - Shared Domain Contracts & Types
 * Source of truth for client-server communication and domain interfaces.
 */

export type SourceRef = {
  id: string;
  label: string;
};

export type RoomResult = {
  roomTypeId: string;
  name: string;
  maxOccupancy: number;
  bedConfiguration: string;
  nightlyRate: number;
  currency: "USD";
  nights: number;
  totalPrice: number;
  amenities: string[];
};

export type AvailabilitySlots = {
  checkIn?: string | null;   // YYYY-MM-DD
  checkOut?: string | null;  // YYYY-MM-DD
  adults?: number | null;
};

export type AvailabilityQuery = {
  checkIn: string;
  checkOut: string;
  adults: number;
};

export type AvailabilityResult = {
  query: AvailabilityQuery & { nights: number };
  rooms: RoomResult[];
};

export type ChatResponse =
  | {
      requestId: string;
      sessionId: string;
      type: "answer";
      message: string;
      sources: SourceRef[];
    }
  | {
      requestId: string;
      sessionId: string;
      type: "room_suitability";
      message: string;
      rooms: RoomResult[];
    }
  | {
      requestId: string;
      sessionId: string;
      type: "needs_input";
      message: string;
      missingFields: Array<"checkIn" | "checkOut" | "adults">;
      currentValues: Partial<{ checkIn: string; checkOut: string; adults: number }>;
    }
  | {
      requestId: string;
      sessionId: string;
      type: "availability_result";
      message: string;
      query: { checkIn: string; checkOut: string; adults: number; nights: number };
      rooms: RoomResult[];
    }
  | {
      requestId: string;
      sessionId: string;
      type: "fallback";
      message: string;
      reason: "unsupported" | "ambiguous" | "model_unavailable";
    }
  | {
      requestId: string;
      sessionId: string;
      type: "error";
      message: string;
      retryable: boolean;
    };

export type SessionTurn = {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
};

export type SessionState = {
  id: string;
  history: SessionTurn[];
  availabilitySlots: AvailabilitySlots;
  lastIntent?: string;
  updatedAt: number;
  scopedState?: any; // ScopedConversationState
};

export interface SessionStore {
  get(sessionId: string): Promise<SessionState | null>;
  save(session: SessionState): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export interface AvailabilityProvider {
  check(query: AvailabilityQuery): Promise<AvailabilityResult>;
}

export type IntentCategory = "property" | "policies" | "amenities" | "rooms" | "faqs" | null;

export type IntentType =
  | "knowledge"
  | "room_suitability"
  | "availability"
  | "out_of_scope"
  | "ambiguous";

export type IntentResult = {
  intent: IntentType;
  category: IntentCategory;
  slots: AvailabilitySlots;
  confidence: "high" | "medium" | "low";
};

export type GroundedAnswerResult = {
  supported: boolean;
  reply: string;
  sourceIds: string[];
};

export interface LLMClient {
  classifyIntent(input: {
    message: string;
    today: string;
    existingSlots: AvailabilitySlots;
    history: SessionTurn[];
  }): Promise<IntentResult>;

  generateGroundedAnswer(input: {
    message: string;
    facts: Array<{ id: string; title: string; text: string }>;
  }): Promise<GroundedAnswerResult>;
}
