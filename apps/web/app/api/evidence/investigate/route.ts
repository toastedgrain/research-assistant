import { NextResponse } from "next/server";
import { createLearningGenerationProvider } from "../../../../lib/ai/factory";
import { LearningGenerationError } from "../../../../lib/ai/provider";
import { investigateRequestSchema } from "../../../../lib/evidence-graph/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = investigateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The investigation request was not a valid bounded EvidencePacket." }, { status: 400 });
  try {
    const result = await createLearningGenerationProvider().investigate(parsed.data.question, parsed.data.packet);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LearningGenerationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "unavailable" ? 503 : error.code === "timeout" ? 504 : 422 });
    }
    return NextResponse.json({ error: "The investigator failed closed." }, { status: 502 });
  }
}
