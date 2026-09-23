# Aster House Guest Assistant - Privacy & Data Minimization Architecture

## 1. Privacy by Design Principles

Aster House implements privacy-by-design controls to protect guest confidentiality and facilitate compliance reviews (e.g. GDPR, CCPA).

### Core Privacy Guarantees
1. **Zero Raw Transcript Indefinite Retention**:
   - Conversational sessions maintain bounded history (`MAX_HISTORY_TURNS = 6`). Older turns are evicted from the active working set.
2. **Deterministic PII Sanitization**:
   - Telemetry emitted to console and monitoring sinks passes through `src/server/security/pii.ts`.
   - Credit card numbers, phone numbers, email addresses, and auth headers are automatically sanitized to `[REDACTED_*]`.
3. **Session ID Anonymization**:
   - Session identifiers are hashed using SHA-256 (`hashSessionId`) prior to being logged. Operators can correlate trace requests without exposing guest session identifiers.
4. **No Payment Card Processing**:
   - The conversational assistant explicitly does not collect or process credit card payments. If a guest types a card number, the assistant abstains and telemetry scrubs the string.

---

## 2. Data Deletion Hooks

The `SessionStore` interface exposes an explicit `delete(sessionId: string)` contract. When a guest or front desk agent triggers a data erasure request, the session record and active working memory are immediately purged from the store.
