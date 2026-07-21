import { describe, expect, it, vi } from "vitest";
import type { VisualGenerationRequest } from "../visual-learning/contracts";
import { OllamaLearningProvider, type OllamaClient } from "./ollama-provider";
import { LearningGenerationError } from "./provider";

const request = {
  paper: { paperId: "paper", title: "Paper", arxivId: null }, intent: "process-game", learningObjective: "Learn", difficulty: "easy", learningMode: "play",
  selection: { text: "Source", page: 0 }, sourceWindow: [{ id: "p", page: 0, text: "Source" }], concepts: [], assets: [], citations: [],
  sourceEvidence: [{ id: "evidence", reason: "source", source: { paperId: "paper", page: 0, kind: "passage", text: "Source" } }],
} as VisualGenerationRequest;

function client(overrides: Partial<OllamaClient> = {}): OllamaClient {
  return {
    list: vi.fn(async () => ({ models: [{ name: "configured-model" }] })),
    generate: vi.fn(async () => ({ response: JSON.stringify({ status: "insufficient-evidence", reason: "The source does not prove a game state." }) })),
    abort: vi.fn(),
    ...overrides,
  };
}

const config = { provider: "ollama" as const, ollamaUrl: "http://localhost:11434", model: "configured-model", timeoutMs: 1000 };

describe("Ollama learning provider", () => {
  it("reports available and returns validated structured output", async () => {
    const provider = new OllamaLearningProvider(config, client());
    await expect(provider.status()).resolves.toMatchObject({ available: true, modelAvailable: true, model: "configured-model" });
    await expect(provider.generateVisualChallenge(request)).resolves.toEqual({ status: "insufficient-evidence", reason: "The source does not prove a game state." });
  });

  it("reports unavailable service and missing model without crashing core learning", async () => {
    const offline = new OllamaLearningProvider(config, client({ list: vi.fn(async () => { throw new Error("offline"); }) }));
    await expect(offline.status()).resolves.toMatchObject({ available: false, reason: "service-unavailable" });
    const missing = new OllamaLearningProvider(config, client({ list: vi.fn(async () => ({ models: [] })) }));
    await expect(missing.status()).resolves.toMatchObject({ available: false, reason: "model-unavailable" });
    await expect(missing.generateVisualChallenge(request)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("retries malformed output once, then fails closed", async () => {
    const fake = client({ generate: vi.fn(async () => ({ response: "not json" })) });
    const provider = new OllamaLearningProvider(config, fake);
    await expect(provider.generateVisualLearningSpec(request)).rejects.toMatchObject({ code: "invalid-output" });
    expect(fake.generate).toHaveBeenCalledTimes(2);
  });

  it("aborts and reports timeout", async () => {
    const fake = client({ generate: vi.fn(() => new Promise<{ response: string }>(() => undefined)) });
    const provider = new OllamaLearningProvider({ ...config, timeoutMs: 2 }, fake);
    await expect(provider.generateVisualChallenge(request)).rejects.toEqual(expect.objectContaining<Partial<LearningGenerationError>>({ code: "timeout" }));
    expect(fake.abort).toHaveBeenCalled();
  });
});
