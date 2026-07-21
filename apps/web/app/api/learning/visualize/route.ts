import { NextResponse } from "next/server";
import { createLearningGenerationProvider } from "../../../../lib/ai/factory";
import { LearningGenerationError } from "../../../../lib/ai/provider";
import { VisualGenerationRequestSchema } from "../../../../lib/visual-learning/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = VisualGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The visual request was not valid bounded research context." }, { status: 400 });
  }
  try {
    const response = await createLearningGenerationProvider().generateVisualLearningSpec(parsed.data);
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LearningGenerationError) {
      const status = error.code === "unavailable" ? 503 : error.code === "timeout" ? 504 : 422;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Local visual generation failed safely." }, { status: 502 });
  }
}
