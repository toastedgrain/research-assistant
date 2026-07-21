import { NextResponse } from "next/server";
import { createLearningGenerationProvider } from "../../../../lib/ai/factory";
import { LearningGenerationError } from "../../../../lib/ai/provider";
import { tensionRequestSchema } from "../../../../lib/evidence-graph/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = tensionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tension inspection requires two valid bounded EvidencePackets from different papers." }, { status: 400 });
  try {
    const candidates = await createLearningGenerationProvider().generateTensionCandidates(parsed.data.paperA, parsed.data.paperB);
    return NextResponse.json(candidates.length ? { status: "ready", candidates } : { status: "insufficient-evidence", reason: "No careful cross-paper candidate was supported by both evidence packets." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LearningGenerationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "unavailable" ? 503 : error.code === "timeout" ? 504 : 422 });
    }
    return NextResponse.json({ error: "Cross-paper inspection failed closed." }, { status: 502 });
  }
}
