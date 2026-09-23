# Aster House Guest Assistant - Knowledge Governance & Ingestion

## 1. The Operational Problem

Hotel operations change frequently:
- Check-in/out hours adjust seasonally.
- Parking fees increase.
- Pool or fitness facilities close for maintenance.
- New breakfast pricing or pet policies are drafted.

If changes require code edits or redeploying JSON files, operational delays and drift are inevitable. Conversely, if raw staff uploads automatically become live production truth, prompt injections, contradictory policies, and hallucinated claims will reach guests.

---

## 2. Ingestion Pipeline & Quality Gates

The pipeline enforces five discrete phases:

```text
[UPLOAD] -> [HASH & PROVENANCE] -> [PARSING & SCHEMA VALIDATION] -> [CONFLICT DETECTION] -> [HUMAN SUPERVISOR APPROVAL] -> [PUBLISH vN+1]
```

1. **Upload**: Supports TXT, Markdown, CSV, and JSON (and mock PDF text).
2. **Provenance & Hashing**: Computes SHA-256 hash. Duplicate file uploads with identical hashes are immediately detected and rejected.
3. **Candidate Fact Extraction**: Extracts titles, summaries, and key-value facts into structured candidate items.
4. **Conflict Detection**:
   - Matches candidate facts against existing active knowledge.
   - Discrepancies in checkout times, rates, or policy terms generate high-severity warnings.
5. **Human Approval**:
   - Held in `/ops` ingestion queue.
   - Supervisor reviews differences and clicks "Approve & Publish".
   - Version number increments (`vN -> vN+1`); previous version is marked `superseded`.
6. **Instant Rollback**:
   - If an error is spotted post-publication, operators can single-click rollback to any prior known-good version.
