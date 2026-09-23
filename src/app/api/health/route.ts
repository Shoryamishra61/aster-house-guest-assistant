import { NextResponse } from "next/server";

export async function GET() {
  const mode = process.env.LLM_MODE || (process.env.MOCK_LLM === "false" ? "real" : "mock");
  return NextResponse.json({
    status: "ok",
    service: "aster-house-guest-assistant",
    llmMode: mode,
    timestamp: new Date().toISOString(),
  });
}
