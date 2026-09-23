# Incident Runbook: Bad Knowledge Publication Recovery

## 1. Symptoms
- Guests report incorrect parking rates, pet fees, or pool hours in chat.
- Negative feedback reasons cite `outdated_information` or `incorrect` in `/ops` feedback queue.

## 2. Immediate Diagnostic Steps
1. Navigate to `/ops` -> **Knowledge Base**.
2. Identify the active knowledge version number (e.g. `v3`) and inspect recent candidate changes.
3. Review `/ops` Ingestion records to see who approved the change and which source document caused the error.

## 3. Instant Rollback Execution
1. In the **Version History & Instant Rollback** panel, locate the last known-good version (e.g. `v2`).
2. Click **Rollback to v2**.
3. Confirm the modal prompt.
4. The system publishes `v4` containing the exact verified facts from `v2` within <100ms.
5. In-memory and distributed cache pointers update immediately.

## 4. Verification
1. Open guest chat (`/`).
2. Ask the affected question (e.g. *"What is the parking rate?"*).
3. Confirm the correct rate is served immediately.
