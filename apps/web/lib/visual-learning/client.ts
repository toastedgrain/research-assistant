import type { LearningAiStatus } from "../ai/provider";
import {
  VisualChallengeGenerationResponseSchema,
  VisualLearningGenerationResponseSchema,
  type VisualChallengeGenerationResponse,
  type VisualGenerationRequest,
  type VisualLearningGenerationResponse,
} from "./contracts";
import {
  generatedVisualCacheKey,
  IndexedDbGeneratedVisualRepository,
  type GeneratedArtifactKind,
  type GeneratedArtifactResponse,
} from "./cache";
import { validateVisualChallengeResponse, validateVisualLearningResponse } from "./validation";

export class VisualGenerationClientError extends Error {
  constructor(readonly code: "unavailable" | "request-failed" | "invalid-response", message: string) {
    super(message);
    this.name = "VisualGenerationClientError";
  }
}

export async function loadLearningAiStatus(signal?: AbortSignal): Promise<LearningAiStatus> {
  try {
    const response = await fetch("/api/ai/status", { cache: "no-store", signal });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json() as Partial<LearningAiStatus>;
    if ((body.provider !== "ollama" && body.provider !== "disabled") || typeof body.available !== "boolean") {
      throw new Error("invalid status");
    }
    return {
      provider: body.provider,
      available: body.available,
      model: typeof body.model === "string" ? body.model : null,
      modelAvailable: Boolean(body.modelAvailable),
      runsLocally: true,
      ...(body.reason ? { reason: body.reason } : {}),
    };
  } catch {
    return { provider: "ollama", available: false, model: null, modelAvailable: false, runsLocally: true, reason: "service-unavailable" };
  }
}

async function generate(
  kind: GeneratedArtifactKind,
  request: VisualGenerationRequest,
  options: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal } = {},
): Promise<GeneratedArtifactResponse> {
  const status = await loadLearningAiStatus(options.signal);
  if (!status.available || !status.model) {
    throw new VisualGenerationClientError("unavailable", "Visual AI is unavailable; core source-grounded learning remains available.");
  }
  const repository = options.repository ?? new IndexedDbGeneratedVisualRepository();
  const key = generatedVisualCacheKey(request, kind, status.model);
  const cached = await repository.get(key).catch(() => null);
  if (cached?.model === status.model && cached.kind === kind) {
    return kind === "learning"
      ? validateVisualLearningResponse(VisualLearningGenerationResponseSchema.parse(cached.response), request)
      : validateVisualChallengeResponse(VisualChallengeGenerationResponseSchema.parse(cached.response), request);
  }

  const response = await fetch(kind === "learning" ? "/api/learning/visualize" : "/api/learning/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = response.status === 503 ? "unavailable" : "request-failed";
    throw new VisualGenerationClientError(code, typeof body?.error === "string" ? body.error : "Visual generation failed safely.");
  }
  try {
    const validated = kind === "learning"
      ? validateVisualLearningResponse(body, request)
      : validateVisualChallengeResponse(body, request);
    await repository.put({
      key,
      kind,
      paperId: request.paper.paperId,
      model: status.model,
      schemaVersion: "1",
      createdAt: Date.now(),
      response: validated,
    }).catch(() => undefined);
    return validated;
  } catch (error) {
    throw new VisualGenerationClientError("invalid-response", error instanceof Error ? error.message : "Visual output failed validation.");
  }
}

export async function generateVisualLearning(
  request: VisualGenerationRequest,
  options?: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal },
): Promise<VisualLearningGenerationResponse> {
  return generate("learning", request, options) as Promise<VisualLearningGenerationResponse>;
}

export async function generateVisualChallenge(
  request: VisualGenerationRequest,
  options?: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal },
): Promise<VisualChallengeGenerationResponse> {
  return generate("challenge", request, options) as Promise<VisualChallengeGenerationResponse>;
}
