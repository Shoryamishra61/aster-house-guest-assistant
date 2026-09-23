# Aster House Guest Assistant - Capacity Plan & Sizing Model

## 1. Scale Dimensions & Assumptions

We model the operational scale for Aster House across its flagship property and anticipated expansion:

| Dimension | Baseline Property (100 Rooms) | Multi-Property Cluster (10 Properties) | Peak Seasonal Surge |
| :--- | :--- | :--- | :--- |
| **Registered / Historical Guests** | 45,000 | 450,000 | 600,000 |
| **Monthly Active Users (MAU)** | 12,000 | 120,000 | 250,000 |
| **Daily Active Users (DAU)** | 800 | 8,000 | 20,000 |
| **Peak Concurrent Sessions** | 50 | 500 | 1,500 |
| **Peak Requests / Sec (RPS)** | 15 req/s | 150 req/s | 450 req/s |
| **Average Messages / Session** | 3.5 | 3.5 | 4.2 |
| **Availability Checks / Session** | 1.2 | 1.2 | 1.8 |
| **LLM Invocations / Message** | 0.8 (20% routed deterministically) | 0.8 | 0.6 (more form usage) |
| **Session State Storage (Redis)** | ~15 MB | ~150 MB | ~500 MB |

---

## 2. Benchmark Honesty: Local vs Production Capacity

To adhere strictly to engineering truthfulness, we separate measured local performance from unverified cloud targets:

### A. Local In-Process Orchestrator Microbenchmark (Measured)
- **Execution Target**: Pure TypeScript orchestrator core (`tests/integration/loadSmoke.test.ts`).
- **Measured Throughput**: **1,470 req/sec**.
- **Measured p50 Latency**: **5 ms**.
- **Measured p95 Latency**: **13 ms**.
- **Success Rate**: **100% (100/100, zero errors)**.

### B. Local HTTP Server Path Benchmark (Measured)
- **Execution Target**: Live Next.js server via network loopback (`tests/loadBenchmark.ts`).
- **Total Requests**: 100 requests (concurrency: 10).
- **Measured Throughput**: **146.8 req/sec**.
- **Measured p50 Latency**: **64 ms**.
- **Measured p95 Latency**: **97 ms**.
- **Measured p99 Latency**: **122 ms**.
- **Success Rate**: **100% (100/100, zero 5xx errors)**.

### C. Multi-Instance Production Capacity (Designed / Not Yet Cloud-Benchmarked)
- **Architecture**: Stateless container cluster behind an Application Load Balancer.
- **Requirements for 1M MAU Scale**:
  - Replace in-memory session store with AWS ElastiCache Redis.
  - Configure Redis-backed distributed rate limiter.
  - Minimum cluster sizing: 3 Node.js container instances (2 vCPU, 4GB RAM each).
  - Target cluster capacity: 600–1,200 RPS.
  - **Explicit Status**: *Architecture is structured to scale horizontally after replacing local in-memory adapters; production cloud deployment has NOT yet been benchmarked on representative hardware.*
