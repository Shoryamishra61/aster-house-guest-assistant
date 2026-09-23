# Aster House Guest Assistant - LLM Cost Model & Optimization

## 1. Cost Hierarchy

To prevent runaway operational costs at scale, Aster House employs a strict hierarchical routing model:

1. **Structured Form Submissions (Availability)**:
   - **Cost**: **$0.00** (Zero LLM calls).
   - Routed directly to pure TypeScript domain availability calculator.
2. **Exact Deterministic FAQ Matches**:
   - High-confidence lexical matches can optionally bypass model generation and render directly from ground truth summaries.
3. **Intent Classification & Bounded Grounding**:
   - Input Tokens / Request: ~450 tokens (prompt + system rules + recent turns).
   - Output Tokens / Request: ~80 tokens (structured JSON intent or grounded response).
   - Estimated Cost per 1,000 requests: **~$0.15** (using standard modern flash-tier pricing).

---

## 2. Monthly Cost Projection (100,000 Monthly Active Guests)

| Traffic Tier | Monthly Messages | % Deterministic | LLM Invocations | Est. Monthly LLM Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Conservative (50k guests)** | 175,000 | 35% | 113,750 | **$17.06** |
| **Standard (100k guests)** | 350,000 | 40% | 210,000 | **$31.50** |
| **Peak Surge (250k guests)** | 1,050,000 | 45% | 577,500 | **$86.63** |

*Note: Infrastructure costs (Compute, Load Balancing, Redis) are separate and estimated at ~$120/month on standard cloud container hosting.*
