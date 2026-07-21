import { NextResponse } from "next/server";
import { createLearningGenerationProvider } from "../../../../lib/ai/factory";
import { LearningGenerationError } from "../../../../lib/ai/provider";
import { boundedResearchGraphSchema } from "../../../../lib/evidence-graph/generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = boundedResearchGraphSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The bounded evidence graph was invalid." }, { status: 400 });
  try {
    const graph = await createLearningGenerationProvider().generateEvidenceGraphCandidates(parsed.data);
    return NextResponse.json({ status: "ready", graph }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LearningGenerationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "unavailable" ? 503 : error.code === "timeout" ? 504 : 422 });
    }
    return NextResponse.json({ error: "Evidence relationship generation failed closed." }, { status: 502 });
  }
}
