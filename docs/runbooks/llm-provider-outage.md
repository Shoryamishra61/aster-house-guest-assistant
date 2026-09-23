# Incident Runbook: LLM Provider Outage / High Latency

## 1. Symptoms
- Telemetry emits `errorCode: LLM_TIMEOUT` or `intent_classification_failed`.
- P95 latency exceeds 4,000ms.
- Guest chat displays fallback responses ("I couldn't process your request right now...").

## 2. Immediate Diagnostic Steps
1. Inspect server logs for OpenAI 500/503/429 status codes.
2. Check `/ops` System Status panel.
3. Verify network connectivity from server cluster to model endpoints.

## 3. Immediate Mitigations
1. Navigate to `/ops` -> **Kill Switches & Flags**.
2. Toggle `groundedLlmPhrasing` to **DISABLED**:
   - Forces the assistant to serve deterministic grounded summaries directly from verified knowledge facts without calling model generation endpoints.
3. If intent classification is also failing, toggle `forceDeterministicFaqOnly` to **ENABLED**.
4. Guests continue receiving accurate check-in times, policy FAQs, and deterministic availability results without degradation.

## 4. Recovery & Post-Incident Verification
1. Once upstream provider status page reports resolution, re-enable flags in staging.
2. Verify latency drops below 2,500ms.
3. Re-enable `groundedLlmPhrasing` on production.
