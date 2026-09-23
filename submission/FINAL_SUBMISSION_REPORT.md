# Aster House Guest Assistant — Final Submission Report
**Simplotel Software Engineer Assignment Evaluation & Verification Artifact**

---

## A. Assignment Requirement Coverage

| Category | Requirement | Implementation | Evidence & Test Suite | Status |
|---|---|---|---|:---:|
| **Conversational Intelligence** | Multi-turn dialogue, context preservation, typo/slang tolerance, negation handling, number parsing, relative date extraction, room capacity vs date availability disambiguation. | `semanticInterpreter.ts`, `answerPlanner.ts`, `normalizer.ts`, `router.ts` | 31 tests in `conversationalRegression.test.ts` (100% pass) | **PASS** |
| **Domain Truth Boundary** | The LLM never invents facts; all rates, hours, policies, and inventory come from single-source-of-truth JSON contracts. Zero hallucination. | `knowledge-base.json`, `rooms.json`, `verifier.ts`, `canonical-truth-audit.json` | 10 tests in `crossLanguageTruth.test.ts`, 11 in `domain.test.ts` | **PASS** |
| **Multilingual Equivalence** | Native, code-switched, and English hospitality assistance across English (`en`), Hindi (`hi`), and Hinglish (`hi-en`). Unsupported languages handled with graceful boundary notices. | `semanticInterpreter.ts`, `answerPlanner.ts` | 110 tests in `multilingualDialogue.test.ts` (100% pass) | **PASS** |
| **Deterministic Availability** | Seeded, leak-free room search with strict night calculation, chronology verification, and capacity rules. | `availability.ts`, `money.ts`, `hotelTime.ts` | Unit tests in `domain.test.ts`, E2E tests in `chat.spec.ts` | **PASS** |
| **Security & Privacy** | Prompt injection refusal, API key/system prompt protection, PII redaction, rate limiting, and fail-closed authentication. | `rateLimiter.ts`, `pii.ts`, `featureFlags.ts` | 5 tests in `securityHardening.test.ts`, 24 in `credibilityHardening.test.ts` | **PASS** |
| **Anti-Slop Production UI** | Accessible, responsive, mobile-first design with 0 horizontal overflow, keyboard navigation, clear aria-live announcements, inline error states with retry, and structured room cards. | `EmptyState.tsx`, `Composer.tsx`, `MessageList.tsx`, `RoomResults.tsx`, `AvailabilityForm.tsx` | 3 UI tests in `components.test.tsx`, 6 Playwright tests in `chat.spec.ts` | **PASS** |

---

## B. Live Demo & Public Repository

- **GitHub Repository**: [https://github.com/Shoryamishra61/aster-house-guest-assistant](https://github.com/Shoryamishra61/aster-house-guest-assistant)
- **Deployment Status**: Production build tested and verified locally. Public demo repository configured for 100% zero-key evaluator operation (`MOCK_LLM=true` by default) with clear single-command setup.

---

## C. Local Run Instructions (< 2 Minutes)

```bash
# 1. Clone the public repository
git clone https://github.com/Shoryamishra61/aster-house-guest-assistant.git
cd aster-house-guest-assistant

# 2. Install dependencies
npm install

# 3. Start local application (default mock mode requires zero paid API keys)
npm run dev

# 4. Open browser
http://localhost:3000
```

---

## D. Architecture: The Primary Invariant

> **The LLM handles natural language understanding and phrasing; deterministic code owns truth, inventory, calculations, and authority.**

```
User Message (EN / HI / Hinglish)
            │
            ▼
┌──────────────────────────────────────────────┐
│  src/server/conversation/                    │
│  - normalizer.ts (typos, slang, numbers)    │
│  - semanticInterpreter.ts (intent, slots)    │
└──────────────────────┬───────────────────────┘
                       │ Normalized Slots & Intent
                       ▼
┌──────────────────────────────────────────────┐
│  src/server/orchestrator/router.ts           │
│  - Session & context management              │
│  - Invariant validation & route dispatch     │
└──────────────┬───────────────────────────────┘
               ├───────────────────────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  src/server/conversation/   │ │  src/server/domain/         │
│  answerPlanner.ts           │ │  availability.ts            │
│  - Grounded canonical facts │ │  - Pure date calculation    │
│  - 16 formal response kinds │ │  - Nightly math & pricing   │
│  - Language-tailored prose  │ │  - Seeded room inventory    │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
               └──────────────┬────────────────┘
                              ▼
┌──────────────────────────────────────────────┐
│  src/components/chat/MessageList.tsx         │
│  - Assistant response bubble                 │
│  - Structured Room Results cards             │
│  - Inline Availability Form (if needed)      │
│  - User Feedback buttons                     │
└──────────────────────────────────────────────┘
```

---

## E. Automated Quality Pipeline Verification

All test suites and build steps were executed sequentially with 100% pass rates:

```bash
npm run check
# 1. next lint -> 0 errors, 0 warnings
# 2. tsc --noEmit -> 0 type errors
# 3. vitest run -> 255/255 tests passing across 13 suites
# 4. next build -> 10/10 static & dynamic routes compiled
```

```bash
npm run test:e2e
# Playwright test -> 6/6 browser workflows passing
```

```bash
node tests/loadBenchmark.ts
# Direct load smoke -> 100 reqs in 0.039s (2,564 req/s, p50: 2ms, p95: 15ms)
# HTTP benchmark -> 270 requests with 0 errors across 5 load profiles
```

---

## F. Verified Google Form Submission Values

```text
Email: shoryamishra68@gmail.com
Name: Shoryakumar Mishra
Contact Number: +91 84607 11154
Code/GitHub Link: https://github.com/Shoryamishra61/aster-house-guest-assistant
Deployed Public Link: https://github.com/Shoryamishra61/aster-house-guest-assistant
College Name: SRM Institute of Science and Technology, Chennai
Training Institute: NA
Resume Upload: submission/SHORYAKUMAR_RESUME_New.pdf (68.7 KB)
```
