/**
 * Aster House Guest Assistant - Workload-Specific HTTP Load Benchmark
 * Evaluates performance across 5 specific profiles:
 * - PERF-FAQ: FAQ-heavy traffic
 * - PERF-AVAIL: Availability-heavy traffic
 * - PERF-MIXED: 70% FAQ / 30% Availability
 * - PERF-BURST: High-concurrency burst
 * - PERF-LIMIT: Intentionally tripping rate limit
 */

interface ProfileResult {
  profile: string;
  requests: number;
  concurrency: number;
  durationSec: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  successful: number;
  rateLimited429: number;
  otherErrors: number;
}

async function runProfile(
  name: string,
  totalRequests: number,
  concurrency: number,
  payloadGenerator: (idx: number) => { payload: Record<string, unknown>; ip: string },
  baseUrl: string
): Promise<ProfileResult> {
  const latencies: number[] = [];
  let successful = 0;
  let rateLimited429 = 0;
  let otherErrors = 0;

  const queue = Array.from({ length: totalRequests }, (_, i) => i);

  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift();
      if (idx === undefined) break;

      const { payload, ip } = payloadGenerator(idx);
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            sessionId: `sess_${name}_${idx % 10}`,
            ...payload,
          }),
        });

        const elapsed = Date.now() - t0;
        latencies.push(elapsed);

        if (res.ok) {
          successful++;
        } else if (res.status === 429) {
          rateLimited429++;
        } else {
          otherErrors++;
        }
      } catch {
        otherErrors++;
      }
    }
  }

  const start = Date.now();
  const pool = Array.from({ length: concurrency }, () => worker());
  await Promise.all(pool);
  const durationSec = (Date.now() - start) / 1000;

  latencies.sort((a, b) => a - b);
  const p50Ms = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99Ms = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = Math.round((totalRequests / (durationSec || 0.001)) * 10) / 10;

  return {
    profile: name,
    requests: totalRequests,
    concurrency,
    durationSec,
    rps,
    p50Ms,
    p95Ms,
    p99Ms,
    successful,
    rateLimited429,
    otherErrors,
  };
}

async function runAllBenchmarks() {
  const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
  console.log(`\n================ RUNNING WORKLOAD-SPECIFIC HTTP BENCHMARKS (${BASE_URL}) ================`);

  // 1. PERF-FAQ
  const resFaq = await runProfile(
    "PERF-FAQ",
    50,
    10,
    (idx) => ({
      payload: { message: idx % 2 === 0 ? "What time is check-in?" : "Is breakfast included?" },
      ip: `10.1.0.${(idx % 10) + 1}`,
    }),
    BASE_URL
  );

  // 2. PERF-AVAIL
  const resAvail = await runProfile(
    "PERF-AVAIL",
    50,
    10,
    (idx) => ({
      payload: {
        message: "Check room availability for 2 guests",
        availability: { checkIn: "2026-11-15", checkOut: "2026-11-18", adults: 2 },
      },
      ip: `10.2.0.${(idx % 10) + 1}`,
    }),
    BASE_URL
  );

  // 3. PERF-MIXED (70% FAQ / 30% Avail)
  const resMixed = await runProfile(
    "PERF-MIXED",
    60,
    10,
    (idx) => {
      const isAvail = idx % 10 >= 7;
      return {
        payload: isAvail
          ? {
              message: "Check dates",
              availability: { checkIn: "2026-11-10", checkOut: "2026-11-12", adults: 2 },
            }
          : { message: "What are the pool hours?" },
        ip: `10.3.0.${(idx % 10) + 1}`,
      };
    },
    BASE_URL
  );

  // 4. PERF-BURST (High Concurrency 20)
  const resBurst = await runProfile(
    "PERF-BURST",
    40,
    20,
    (idx) => ({
      payload: { message: "What is your check-out policy?" },
      ip: `10.4.0.${(idx % 10) + 1}`,
    }),
    BASE_URL
  );

  // 5. PERF-LIMIT (Intentionally trip rate limiter on single IP)
  const resLimit = await runProfile(
    "PERF-LIMIT",
    70,
    15,
    () => ({
      payload: { message: "Quick burst test" },
      ip: "198.51.100.99", // Single external IP limited to 60 req/min
    }),
    BASE_URL
  );

  const results = [resFaq, resAvail, resMixed, resBurst, resLimit];

  console.log("\n| Profile | Requests | Concurrency | Duration | RPS | p50 | p95 | p99 | Success | 429 | Errors |");
  console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const r of results) {
    console.log(
      `| ${r.profile} | ${r.requests} | ${r.concurrency} | ${r.durationSec.toFixed(2)}s | ${r.rps} | ${r.p50Ms}ms | ${r.p95Ms}ms | ${r.p99Ms}ms | ${r.successful} | ${r.rateLimited429} | ${r.otherErrors} |`
    );
  }
  console.log("========================================================================================\n");
}

runAllBenchmarks().catch((err) => {
  console.error("Benchmark suite failed:", err);
  process.exit(1);
});
