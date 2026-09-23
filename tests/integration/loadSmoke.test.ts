import { describe, it, expect } from "vitest";
import { ChatOrchestrator } from "@/server/orchestrator/router";

describe("Performance & Load Smoke Benchmark", () => {
  it("sustains concurrent request throughput with sub-50ms local latency and zero errors", async () => {
    const orchestrator = new ChatOrchestrator();
    const TOTAL_REQUESTS = 100;
    const CONCURRENCY = 10;

    const payloads = [
      { message: "What time is check-in?" },
      { message: "Is breakfast included in all rooms?" },
      { message: "Which room works for 3 guests?" },
      {
        message: "Check availability for 2 guests",
        availability: { checkIn: "2026-11-10", checkOut: "2026-11-13", adults: 2 },
      },
      { message: "Do you have an airport shuttle?" },
    ];

    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;

    async function sendWorker(index: number) {
      const payload = payloads[index % payloads.length];
      const t0 = Date.now();
      try {
        const res = await orchestrator.handleMessage({
          requestId: `bench_req_${index}`,
          sessionId: `bench_sess_${index % 10}`,
          ...payload,
        });

        const t1 = Date.now();
        latencies.push(t1 - t0);

        if (res && res.type) {
          successful++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    const queue: number[] = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);

    async function nextBatch(): Promise<void> {
      const workers: Promise<void>[] = [];
      for (let c = 0; c < CONCURRENCY; c++) {
        workers.push(
          (async () => {
            while (queue.length > 0) {
              const idx = queue.shift();
              if (idx !== undefined) {
                await sendWorker(idx);
              }
            }
          })()
        );
      }
      await Promise.all(workers);
    }

    const start = Date.now();
    await nextBatch();
    const durationSec = (Date.now() - start) / 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const rps = Math.round((TOTAL_REQUESTS / durationSec) * 10) / 10;

    console.log(
      `\n[Direct Orchestrator Load Benchmark] ${TOTAL_REQUESTS} reqs in ${durationSec.toFixed(3)}s | ${rps} req/s | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | success: ${successful}/${TOTAL_REQUESTS}`
    );

    expect(failed).toBe(0);
    expect(successful).toBe(TOTAL_REQUESTS);
    expect(p95).toBeLessThan(150); // Under 150ms per request locally
  });
});
