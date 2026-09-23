# Aster House Guest Assistant - Service Level Objectives (SLOs) & Error Budgets

## 1. Production Service Level Indicators & Measurement Status

To ensure operational honesty, all metrics below explicitly distinguish between **DESIGN TARGET**, **MEASURED LOCAL BENCHMARK**, and **NOT YET MEASURED IN CLOUD**.

| Service Level Objective (SLO) | Classification | Designed Target | Measured Status (Local) | Measurement Point | Degradation Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Availability** | Invariant / Target | $\ge 99.9\%$ | **100%** (100/100 requests in load smoke) | `POST /api/chat` successful status (<500) | Freeze risky deployments; switch to degraded mode |
| **P95 Request Latency (Mock Mode)** | Benchmarked | $\le 100\text{ ms}$ | **97 ms** (Network HTTP benchmark) | Total request latency recorded in `tests/loadBenchmark.ts` | Profile hot paths; review in-memory cache usage |
| **P95 Request Latency (Live LLM)** | Target (Cloud) | $\le 2500\text{ ms}$ | **NOT YET MEASURED IN CLOUD** | Total request latency recorded in `logger.info` | Enable deterministic FAQ pre-routing; evaluate small model |
| **Grounded Claim Accuracy** | Invariant | $100\%$ | **100% verified** (40/40 golden & PR tests) | Verifier output in `verifyGroundedAnswer` | Reject any ungrounded response; strip unverified sources |
| **Unauthorized Availability Claim** | Invariant | $0\text{ tolerated}$ | **0 observed** | All returned room quotes and booking claims | Hard block: LLM cannot originate pricing or inventory |
| **Cross-Property Data Leakage** | Invariant | $0\text{ tolerated}$ | **0 observed** (4 tenant tests passing) | Multi-tenant scoping queries | Hard block: `propertyId` derived strictly on server |
| **Secret / PII Exposure in Telemetry** | Invariant | $0\text{ tolerated}$ | **0 observed** | Automated regex scan across log streams | Recursive redactor in `src/server/security/pii.ts` |
| **Knowledge Rollback Recovery Time** | Benchmarked | $\le 30\text{ seconds}$ | **< 100 ms** (Unit & E2E tested) | Time from rollback click in `/ops` to active serving | Instant pointer switch and cache invalidation |

---

## 2. Hard Zero-Tolerance Invariants

Aster House enforces five non-negotiable operational invariants:
1. **Zero Cross-Property Data Leakage**: Property A cannot read Property B data or configuration.
2. **Zero Unauthorized Booking Confirmations**: The conversational assistant cannot finalize bookings without a verified external reservation provider.
3. **Zero Unverified Availability Claims**: The assistant cannot claim room availability without explicit execution of the deterministic availability provider.
4. **Zero Secret / Raw PII Exposure in Telemetry**: Credit card strings, passwords, authorization bearer tokens, and emails are scrubbed before serialization.
5. **Zero Unauthorized Mutation of Operational Controls**: In production, `/ops` mutation endpoints reject any request lacking administrative verification.

---

## 3. Error Budget Policy

If the 30-day API availability error budget falls below 50%:
1. Non-essential product feature releases are frozen.
2. The team prioritizes reliability engineering and provider timeout configurations.
3. If LLM provider instability is the root cause, operators activate `forceDeterministicFaqOnly` or `groundedLlmPhrasing = false` via emergency kill switches in `/ops`.
4. Fallback templates handle standard guest inquiries deterministically until upstream provider latency normalizes.
