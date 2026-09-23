# Aster House Guest Assistant - Production Deployment & Verification Guide

## 1. Zero-Setup Local Evaluation (Evaluator Mode)

The application requires zero external accounts, zero API keys, and zero databases for local evaluation.

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Access guest assistant
# http://localhost:3000

# 4. Access operator control plane
# http://localhost:3000/ops
```

---

## 2. Full Quality Verification Gate

Run the complete automated quality suite before submitting changes:

```bash
# Runs ESLint, TypeScript compiler, Vitest unit/integration suite, and Next.js production build
npm run check

# Runs Playwright browser workflows (E2E-01 through E2E-05)
npm run test:e2e
```

---

## 3. Production Environment Promotion

To promote from local evaluation to live production:

1. **Environment Variables**:
   ```env
   NODE_ENV=production
   MOCK_LLM=false
   OPENAI_API_KEY=sk-prod-...
   OPENAI_MODEL=gpt-4o-mini
   SESSION_STORE=redis
   REDIS_URL=rediss://...
   PORT=3000
   ```
2. **Container Build**:
   ```bash
   docker build -t aster-house-guest-assistant:latest .
   ```
3. **Health & Readiness Probes**:
   - Liveness: `GET /api/health`
   - Readiness: Checks active knowledge version and session store connectivity.
