import { NextResponse } from "next/server";
import { createLearningGenerationProvider } from "../../../../lib/ai/factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await createLearningGenerationProvider().status();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
