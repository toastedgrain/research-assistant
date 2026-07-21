import { evidenceKey, type SourceEvidence, type SourceEvidenceKind } from "../evidence/source";

export type ChallengeType =
  | "multiple-choice"
  | "concept-match"
  | "ordering"
  | "evidence-hunt";

export type ChallengeMode = "scored" | "explore";
export type ChallengeDifficulty = "easy" | "medium" | "hard";

export interface ChallengeChoice {
  id: string;
  label: string;
}

export type EvidenceResourceRef =
  | { kind: "passage"; resourceId: string }
  | { kind: "citation"; resourceId: string };

/**
 * A challenge-local name for canonical source evidence. The optional resource reference
 * carries only a deterministic local handle; it never redefines paper/page/asset identity.
 */
export interface ChallengeEvidence {
  id: string;
  source: SourceEvidence;
  reason: string;
  resource?: EvidenceResourceRef;
}

export function challengeEvidence(
  source: SourceEvidence,
  reason: string,
  resource?: EvidenceResourceRef,
): ChallengeEvidence {
  return { id: evidenceKey(source), source, reason, ...(resource ? { resource } : {}) };
}

/** Every scored relationship has its own evidence, never only a challenge-wide source list. */
export interface GroundedRelationship {
  id: string;
  evidenceIds: string[];
  requiredEvidenceKinds?: SourceEvidenceKind[];
  reason: string;
}

export interface MultipleChoicePayload {
  kind: "multiple-choice";
  choices: ChallengeChoice[];
  multiple?: boolean;
}

export interface ConceptMatchPayload {
  kind: "concept-match";
  concepts: ChallengeChoice[];
  definitions: ChallengeChoice[];
}

export interface OrderingPayload {
  kind: "ordering";
  items: ChallengeChoice[];
}

/** The first research-native interaction: find a verified passage in the primary paper. */
export interface EvidenceHuntPayload {
  kind: "evidence-hunt";
  selectionInstruction: string;
  acceptedEvidenceKinds: ["passage", ...SourceEvidenceKind[]];
  closeSectionId?: string;
}

export interface ChoiceAnswer {
  kind: "choice";
  correctChoiceIds: string[];
  relationships: GroundedRelationship[];
}

export interface PairAnswer {
  kind: "pairs";
  pairs: Record<string, string>;
  relationships: GroundedRelationship[];
}

export interface OrderAnswer {
  kind: "order";
  itemIds: string[];
  relationships: GroundedRelationship[];
}

export interface EvidenceHuntAnswer {
  kind: "evidence-hunt";
  acceptedEvidenceIds: string[];
  relationships: GroundedRelationship[];
}

export type ChallengePayload =
  | MultipleChoicePayload
  | ConceptMatchPayload
  | OrderingPayload
  | EvidenceHuntPayload;

export type ChallengeAnswer =
  | ChoiceAnswer
  | PairAnswer
  | OrderAnswer
  | EvidenceHuntAnswer;

export type LearnerResponse =
  | { kind: "choice"; choiceIds: string[] }
  | { kind: "pairs"; pairs: Record<string, string> }
  | { kind: "order"; itemIds: string[] }
  | { kind: "evidence-hunt"; selectedPassageId?: string };

export interface ChallengeHint {
  id: string;
  text: string;
}

export interface ChallengeScoring {
  maxPoints: number;
  partialCredit: boolean;
}

export interface GenerationMetadata {
  generated: true;
  model?: string;
  createdAt: string;
  groundedEvidenceIds: string[];
  confidence?: number;
}

interface ChallengeBase<
  Type extends ChallengeType,
  Payload extends ChallengePayload,
> {
  id: string;
  type: Type;
  paperIds: string[];
  concepts: string[];
  evidence: ChallengeEvidence[];
  prompt: string;
  difficulty: ChallengeDifficulty;
  payload: Payload;
  hints: ChallengeHint[];
  generation?: GenerationMetadata;
}

export interface ScoredChallenge<
  Type extends ChallengeType,
  Payload extends ChallengePayload,
  Answer extends ChallengeAnswer,
> extends ChallengeBase<Type, Payload> {
  mode: "scored";
  answer: Answer;
  scoring: ChallengeScoring;
}

export interface ExploreChallenge<Type extends ChallengeType, Payload extends ChallengePayload>
  extends ChallengeBase<Type, Payload> {
  mode: "explore";
  /** Explore interactions cannot make verified correctness claims or add score. */
  answer?: never;
  scoring?: never;
}

export type MultipleChoiceChallenge =
  | ScoredChallenge<"multiple-choice", MultipleChoicePayload, ChoiceAnswer>
  | ExploreChallenge<"multiple-choice", MultipleChoicePayload>;

export type ConceptMatchChallenge =
  | ScoredChallenge<"concept-match", ConceptMatchPayload, PairAnswer>
  | ExploreChallenge<"concept-match", ConceptMatchPayload>;

export type OrderingChallenge =
  | ScoredChallenge<"ordering", OrderingPayload, OrderAnswer>
  | ExploreChallenge<"ordering", OrderingPayload>;

export type EvidenceHuntChallenge =
  | ScoredChallenge<"evidence-hunt", EvidenceHuntPayload, EvidenceHuntAnswer>
  | ExploreChallenge<"evidence-hunt", EvidenceHuntPayload>;

export type ChallengeSpec =
  | MultipleChoiceChallenge
  | ConceptMatchChallenge
  | OrderingChallenge
  | EvidenceHuntChallenge;

export type ChallengeLifecycle = "idle" | "active" | "submitted" | "revealed" | "complete";

export interface ChallengeReturnRecord {
  challengeId: string;
  lifecycle: ChallengeLifecycle;
  response: LearnerResponse;
  position?: number;
  focusTargetId?: string;
}

export type ChallengeEvaluation =
  | { state: "supported"; message: string; points: number; maxPoints: number }
  | { state: "close"; message: string; points: 0; maxPoints: number }
  | { state: "needs-revision"; message: string; points: 0; maxPoints: number }
  | { state: "unresolved"; message: string; points: 0; maxPoints: number };
