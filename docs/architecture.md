# System Architecture & AI Boundary

## 1. Architectural Philosophy

> **Intelligence is probabilistic; authority is deterministic.**

The system is architected to leverage Large Language Models exclusively where fuzzy natural-language understanding or natural phrasing excels, while reserving all operational authority, policy verification, inventory tracking, date arithmetic, and pricing calculations for deterministic software.

```text
Browser (React + useChat reducer)
  │
  ▼ POST /api/chat
Request Boundary (Zod validation, requestId, rate & length guards)
  │
  ▼
Session Service (bounded 12 turns, typed slots {checkIn, checkOut, adults}, TTL)
  │
  ├─► explicit structured availability payload? ──► Validate directly
  │
  ▼
Intent Classifier (LLMClient + IntentSchema)
  │
  ▼
Deterministic Router
  ├─► knowledge ────────► Lexical KB Retrieval ──► Grounded LLM Phrasing ──► Verifier
  ├─► room_suitability ──► Pure Capacity Filter (findSuitableRooms)
  ├─► availability ─────► Slot Merge ──► Validation ──► checkAvailability() Pure Tool
  ├─► ambiguous ────────► Clarification Response
  └─► out_of_scope ─────► Explicit Non-Speculative Fallback
  │
  ▼
Typed Response Builder (Discriminated union: answer, room_suitability, needs_input, availability_result, fallback, error)
  │
  ▼
Structured Log + Session Update
  │
  ▼
Browser UI (Polite aria-live region, accessible inline form, flat structured room cards)
```

---

## 2. Component Boundaries

### A. Presentation Layer (`src/components/`, `src/hooks/`)
- `useChat`: Strict state machine reducer ensuring that the UI moves predictably across `idle`, `sending`, and `error` states.
- `MessageList`: Accessible chat log using `role="log"` and polite live region updates to prevent screen readers from repeating entire transcripts.
- `AvailabilityForm`: Clean inline form rendered dynamically when required slots (`checkIn`, `checkOut`, `adults`) are missing. Directly submits structured data to bypass NLP parsing.
- `RoomResults`: Flat, non-slop room cards exposing room name, bed setup, max occupancy, nightly rate, total stay cost, and verified amenities.

### B. Gateway Layer (`src/app/api/`)
- `POST /api/chat`: Thin route handler (less than 50 lines). Validates payload size (max 2,000 characters) and schema using Zod, attaches unique `requestId`, and delegates execution to `ChatOrchestrator`.
- `GET /api/health`: Health endpoint exposing service status and configured LLM mode without leaking secrets.

### C. Orchestration Layer (`src/server/orchestrator/`)
- `ChatOrchestrator`: Coordinates the conversation lifecycle. Enforces a strict budget: **at most one intent classification call, at most one grounded generation call, and at most one tool invocation per turn**.

### D. Deterministic Domain Layer (`src/server/domain/`, `src/server/data/`)
- `calculateNights`: Validates calendar chronology (`checkOut > checkIn`).
- `validateAvailabilityQuery`: Rejects past dates, invalid formats, and party sizes exceeding hotel capacity.
- `mergeAvailabilitySlots`: Applies explicit overwrite rules, retaining prior session slots during follow-up turns.
- `findSuitableRooms`: Pure capacity filtering (`maxOccupancy >= adults`) without claiming date availability.
- `checkAvailability`: Pure inventory function using stable hash seeding (`stableHash`) to guarantee deterministic results across runs.

### E. AI Boundary Layer (`src/server/llm/`, `src/server/retrieval/`)
- `LLMClient`: Abstract interface with two implementations:
  - `MockLLMClient`: High-fidelity, zero-cost, offline adapter for CI and evaluators.
  - `RealLLMClient`: Production adapter with timeout controls and JSON schema enforcement.
- `verifyGroundedAnswer`: Post-generation validator checking that `sourceIds` are a strict subset of supplied facts, prohibiting unauthorized availability claims, and validating price claims against ground truth.

---

## 3. Deployment Evolution & Interface Seams

The architecture is built with distinct interfaces so tomorrow's production deployment requires swapping infrastructure adapters without redesigning application code:

1. `SessionStore` -> Managed Redis / Upstash with TTL.
2. `AvailabilityProvider` -> Real Property Management System (PMS) / Central Reservation System (CRS).
3. `LLMClient` -> Managed AI Gateway (Portkey, Cloudflare AI Gateway, or LiteLLM) with multi-provider failover.
4. `KnowledgeStore` -> Versioned Headless CMS or relational database with change approval workflows.
