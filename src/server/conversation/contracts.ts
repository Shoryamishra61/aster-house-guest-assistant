/**
 * Aster House - Normalized Conversational Interpretation & Scoped State Schema
 * Replaces simplistic keyword matching with typed intent ontology, reference resolution,
 * scoped conversation frames, multilingual language detection, response taxonomy, and answer planning.
 */

export type ConversationLanguage = "en" | "hi" | "hi-en" | "unknown";

export type ConversationalIntent =
  | "PROPERTY_FACT"            // address, phone, contact, location
  | "AMENITY_FACT"             // pool, gym, wifi, dining, parking
  | "POLICY_FACT"              // check-in, check-out, cancellation, pet policy, child policy
  | "DINING_FACT"              // breakfast times, inclusions, venue, menus
  | "ROOM_CATALOG"             // list of room types available in the hotel
  | "ROOM_ATTRIBUTE"           // which rooms have two beds, bathtub, desk, etc.
  | "ROOM_SUITABILITY"         // fits X people / party composition without dates
  | "AVAILABILITY_SEARCH"      // availability with dates & guests
  | "AVAILABILITY_FOLLOWUP"    // changing dates, guests, or asking price from previous availability
  | "ROOM_COMPARISON"          // which room is cheapest, largest, smallest
  | "BOOKING_ACTION_UNSUPPORTED" // "cancel my reservation", "book me right now"
  | "RESERVATION_STATE_UNAVAILABLE" // "confirm my booking", "how much did I pay"
  | "SECURITY_REFUSAL"         // API keys, system prompts, private guest data
  | "HUMAN_ESCALATION"         // "talk to manager", "escalate"
  | "OUT_OF_SCOPE"             // Python code, weather, flights, casinos, laundry/spa if unverified
  | "AMBIGUOUS_CLARIFICATION"  // truly ambiguous queries
  | "MULTI_INTENT";            // composite queries like "breakfast and dinner" or "pool and gym"

export type ConversationalResponseKind =
  | "direct_fact"
  | "yes_no_fact"
  | "list"
  | "comparison"
  | "recommendation_from_facts"
  | "availability_result"
  | "needs_information"
  | "clarification"
  | "partial_answer"
  | "unknown_hotel_fact"
  | "unsupported_operation"
  | "reservation_access_unavailable"
  | "human_escalation"
  | "security_refusal"
  | "out_of_scope"
  | "dependency_failure";

export type ResponseReason =
  | "verified_fact"
  | "verified_domain_result"
  | "partial_knowledge"
  | "missing_required_slots"
  | "ambiguous_reference"
  | "unknown_fact"
  | "unsupported_operation"
  | "security_boundary"
  | "human_requested"
  | "dependency_unavailable";

export type SlotSource = "current_message" | "structured_form" | "conversation_context";

export type SlotValue<T> = {
  value: T;
  source: SlotSource;
  turnIndex: number;
};

export type ParsedSubQuestion = {
  text: string;
  intent: ConversationalIntent;
  entity?: string;
  requestedField?: string;
};

export type Interpretation = {
  primaryIntent: ConversationalIntent;
  secondaryIntents: ConversationalIntent[];
  confidence: number;
  detectedLanguage: ConversationLanguage;
  responseKind: ConversationalResponseKind;

  entities: {
    amenity?: string;
    roomType?: string;
    roomAttribute?: string; // "two_beds", "bathtub", "desk", "refrigerator"
    policy?: string;        // "checkin", "checkout", "cancellation", "pet", "child"
    meal?: string;          // "breakfast", "dinner", "lunch"
    targetEntity?: string;  // e.g. "cat" vs "dog"
  };

  negatedEntities?: string[];

  availabilitySlots: {
    checkIn?: SlotValue<string>;
    checkOut?: SlotValue<string>;
    adults?: SlotValue<number>;
  };

  references: {
    pronouns: string[];
    referencedEntity?: string;
    referencedRoomResultIndex?: number; // 1-based index (e.g. "second room")
    referencedPreviousResult?: boolean;
    referencedComparison?: "cheapest" | "most_expensive" | "smallest" | "largest";
  };

  requestedFields: string[];
  unresolvedReferences: string[];
  requiresClarification: boolean;
  clarificationPrompt?: string;

  multiIntentParts?: ParsedSubQuestion[];
};

export type ScopedAvailabilityFrame = {
  checkIn?: SlotValue<string>;
  checkOut?: SlotValue<string>;
  adults?: SlotValue<number>;
  createdTurn: number;
  lastUpdatedTurn: number;
  status: "active" | "completed" | "expired";
};

export type ScopedRoomFrame = {
  lastPresentedRooms: Array<{
    roomTypeId: string;
    name: string;
    nightlyRate: number;
    totalPrice: number;
    maxOccupancy: number;
    bedConfiguration: string;
    amenities: string[];
  }>;
  stayQuery?: {
    checkIn: string;
    checkOut: string;
    adults: number;
    nights: number;
  };
  selectedRoomId?: string;
  createdTurn: number;
};

export type ReferentState = {
  lastAmenity?: string;      // e.g. "swimming_pool", "wifi", "fitness"
  lastPolicy?: string;       // e.g. "pet", "cancellation", "checkin", "checkout"
  lastDining?: string;       // e.g. "breakfast"
  lastRoomType?: string;     // e.g. "King Deluxe"
  lastTopic?: "availability" | "room_suitability" | "amenity" | "policy" | "property";
  turnIndex: number;
};

export type ScopedConversationState = {
  turnCount: number;
  activeTopic?: "availability" | "room_suitability" | "amenity" | "policy" | "property";
  lastLanguage?: ConversationLanguage;
  availabilityFrame?: ScopedAvailabilityFrame;
  roomFrame?: ScopedRoomFrame;
  referents?: ReferentState;
  pendingQuestions?: ParsedSubQuestion[];
};

export type AnswerPlanFact = {
  sourceId: string;
  field: string;
  value: string | number | boolean | string[];
};

export type AnswerPlan = {
  answerType: "DIRECT_FACT" | "ROOM_LIST" | "AVAILABILITY_RESULT" | "NEEDS_INPUT" | "PARTIAL_FACT" | "REFUSAL" | "FALLBACK";
  responseKind: ConversationalResponseKind;
  reasonCode: ResponseReason;
  language: ConversationLanguage;
  requestedFields: string[];
  facts: AnswerPlanFact[];
  unsupportedFields: string[];
  refusalReason?: "SECURITY" | "RESERVATION_UNAVAILABLE" | "OUT_OF_SCOPE" | "AMBIGUOUS" | "UNKNOWN_FACT" | "HUMAN_ESCALATION";
  customMessage?: string;
};
