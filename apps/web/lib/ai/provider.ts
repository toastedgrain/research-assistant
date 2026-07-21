import type {
  VisualChallengeGenerationResponse,
  VisualGenerationRequest,
  VisualLearningGenerationResponse,
} from "../visual-learning/contracts";
import type { ResearchGraph } from "../explore/graph";
import type { EvidencePacket, InvestigatorResult, TensionCandidate } from "../evidence-graph/types";

export interface LearningAiStatus {
  provider: "ollama" | "disabled";
  available: boolean;
  model: string | null;
  modelAvailable: boolean;
  runsLocally: boolean;
  reason?: "provider-disabled" | "model-not-configured" | "service-unavailable" | "model-unavailable";
}

export interface LearningGenerationProvider {
  status(): Promise<LearningAiStatus>;
  isAvailable(): Promise<boolean>;
  generateVisualLearningSpec(request: VisualGenerationRequest): Promise<VisualLearningGenerationResponse>;
  generateVisualChallenge(request: VisualGenerationRequest): Promise<VisualChallengeGenerationResponse>;
  generateEvidenceGraphCandidates(graph: ResearchGraph): Promise<ResearchGraph>;
  generateTensionCandidates(paperA: EvidencePacket, paperB: EvidencePacket): Promise<TensionCandidate[]>;
  investigate(question: string, packet: EvidencePacket): Promise<InvestigatorResult>;
}

export class LearningGenerationError extends Error {
  constructor(
    readonly code: "unavailable" | "timeout" | "invalid-output" | "generation-failed",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LearningGenerationError";
  }
}
