import { Ollama } from "ollama";
import type { LearningAiConfig } from "./config";
import {
  CROSS_PAPER_TENSION_SYSTEM_PROMPT,
  EVIDENCE_GRAPH_SYSTEM_PROMPT,
  INVESTIGATOR_SYSTEM_PROMPT,
  VISUAL_GAME_SYSTEM_PROMPT,
  VISUAL_LEARNING_SYSTEM_PROMPT,
  evidenceGraphRequestPrompt,
  investigatorRequestPrompt,
  tensionRequestPrompt,
  visualGameRequestPrompt,
  visualLearningRequestPrompt,
} from "./prompts";
import type { ResearchGraph } from "../explore/graph";
import type { EvidencePacket, InvestigatorResult, TensionCandidate } from "../evidence-graph/types";
import {
  evidenceGraphJsonSchema,
  investigatorJsonSchema,
  tensionJsonSchema,
  validateGeneratedGraphResponse,
  validateInvestigatorResponse,
  validateTensionResponse,
} from "../evidence-graph/generation";
import {
  LearningGenerationError,
  type LearningAiStatus,
  type LearningGenerationProvider,
} from "./provider";
import {
  visualChallengeJsonSchema,
  visualLearningJsonSchema,
  type VisualChallengeGenerationResponse,
  type VisualGenerationRequest,
  type VisualLearningGenerationResponse,
} from "../visual-learning/contracts";
import {
  validateVisualChallengeResponse,
  validateVisualLearningResponse,
  VisualSpecValidationError,
} from "../visual-learning/validation";

interface OllamaModel {
  name: string;
  model?: string;
}

export interface OllamaClient {
  list(): Promise<{ models: OllamaModel[] }>;
  generate(request: {
    model: string;
    prompt: string;
    system: string;
    stream: false;
    format: object;
    think: false;
    options: { temperature: number; num_ctx: number };
  }): Promise<{ response: string }>;
  abort(): void;
}

type GenerationKind = "learning" | "challenge";

export class OllamaLearningProvider implements LearningGenerationProvider {
  private readonly client: OllamaClient;

  constructor(
    private readonly config: LearningAiConfig,
    client?: OllamaClient,
  ) {
    this.client = client ?? new Ollama({ host: config.ollamaUrl });
  }

  async status(): Promise<LearningAiStatus> {
    if (this.config.provider !== "ollama") {
      return { provider: "disabled", available: false, model: this.config.model, modelAvailable: false, runsLocally: true, reason: "provider-disabled" };
    }
    if (!this.config.model) {
      return { provider: "ollama", available: false, model: null, modelAvailable: false, runsLocally: true, reason: "model-not-configured" };
    }
    try {
      const response = await this.withTimeout(this.client.list(), 10_000);
      const wanted = this.config.model;
      const modelAvailable = response.models.some((item) => item.name === wanted || item.model === wanted);
      return {
        provider: "ollama",
        available: modelAvailable,
        model: wanted,
        modelAvailable,
        runsLocally: true,
        ...(modelAvailable ? {} : { reason: "model-unavailable" as const }),
      };
    } catch {
      return { provider: "ollama", available: false, model: this.config.model, modelAvailable: false, runsLocally: true, reason: "service-unavailable" };
    }
  }

  async isAvailable(): Promise<boolean> {
    return (await this.status()).available;
  }

  async generateVisualLearningSpec(request: VisualGenerationRequest): Promise<VisualLearningGenerationResponse> {
    return this.generate("learning", request) as Promise<VisualLearningGenerationResponse>;
  }

  async generateVisualChallenge(request: VisualGenerationRequest): Promise<VisualChallengeGenerationResponse> {
    return this.generate("challenge", request) as Promise<VisualChallengeGenerationResponse>;
  }

  async generateEvidenceGraphCandidates(graph: ResearchGraph): Promise<ResearchGraph> {
    return this.generateStructured(
      EVIDENCE_GRAPH_SYSTEM_PROMPT,
      evidenceGraphRequestPrompt(graph),
      evidenceGraphJsonSchema as object,
      (value) => validateGeneratedGraphResponse(value, graph),
    );
  }

  async generateTensionCandidates(paperA: EvidencePacket, paperB: EvidencePacket): Promise<TensionCandidate[]> {
    return this.generateStructured(
      CROSS_PAPER_TENSION_SYSTEM_PROMPT,
      tensionRequestPrompt(paperA, paperB),
      tensionJsonSchema as object,
      (value) => validateTensionResponse(value, paperA, paperB),
    );
  }

  async investigate(question: string, packet: EvidencePacket): Promise<InvestigatorResult> {
    return this.generateStructured(
      INVESTIGATOR_SYSTEM_PROMPT,
      investigatorRequestPrompt(question, packet),
      investigatorJsonSchema as object,
      (value) => validateInvestigatorResponse(value, packet),
    );
  }

  private async generate(
    kind: GenerationKind,
    request: VisualGenerationRequest,
  ): Promise<VisualLearningGenerationResponse | VisualChallengeGenerationResponse> {
    const system = kind === "learning" ? VISUAL_LEARNING_SYSTEM_PROMPT : VISUAL_GAME_SYSTEM_PROMPT;
    const basePrompt = kind === "learning" ? visualLearningRequestPrompt(request) : visualGameRequestPrompt(request);
    return this.generateStructured(
      system,
      basePrompt,
      (kind === "learning" ? visualLearningJsonSchema : visualChallengeJsonSchema) as object,
      (value) => kind === "learning"
        ? validateVisualLearningResponse(value, request)
        : validateVisualChallengeResponse(value, request),
    );
  }

  private async generateStructured<T>(
    system: string,
    basePrompt: string,
    format: object,
    validate: (value: unknown) => T,
  ): Promise<T> {
    const status = await this.status();
    if (!status.available || !status.model) {
      throw new LearningGenerationError("unavailable", "The configured local visual model is unavailable.");
    }
    let repair = "";
    let previousError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.withTimeout(this.client.generate({
          model: status.model,
          system,
          prompt: `${basePrompt}${repair}`,
          stream: false,
          format,
          think: false,
          options: { temperature: 0.1, num_ctx: 16_384 },
        }));
        const value = JSON.parse(response.response) as unknown;
        return validate(value);
      } catch (error) {
        previousError = error;
        if (error instanceof LearningGenerationError && error.code === "timeout") throw error;
        const reason = error instanceof Error ? error.message.slice(0, 800) : "invalid structured output";
        repair = `\n\nYour previous output was rejected: ${reason}\nReturn a corrected schema-valid response using only the supplied evidence IDs. Do not add new facts.`;
      }
    }

    const reason = previousError instanceof VisualSpecValidationError || previousError instanceof SyntaxError
      ? "The local model returned output that failed source/schema validation."
      : "The local model could not generate the requested visual interaction.";
    throw new LearningGenerationError("invalid-output", reason, previousError);
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs = this.config.timeoutMs): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            this.client.abort();
            reject(new LearningGenerationError("timeout", "Local visual generation timed out."));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
