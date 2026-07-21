import { evidenceKey, type SourceEvidence, type SourceEvidenceKind } from "../evidence/source";

export type ChallengeType =
  | "multiple-choice"
  | "concept-match"
  | "ordering"
  | "evidence-hunt"
  | "figure-build"
  | "figure-detective"
  | "prediction"
  | "claim-evidence"
  | "paper-check"
  | "paper-vs-paper"
  | "timeline"
  | "evolution";

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

/** Controlled topology only; it is never inferred from figure pixels. */
export interface FigureBuildPayload {
  kind: "figure-build";
  items: ChallengeChoice[];
  diagramLabel: string;
}

export interface FigureDetectivePayload {
  kind: "figure-detective";
  choices: ChallengeChoice[];
  assetId: string;
}

/** Prediction compares a learner's thought with a revealed paper result; it is unscored. */
export interface PredictionPayload {
  kind: "prediction";
  choices: ChallengeChoice[];
  resultEvidenceId: string;
}

export interface ClaimEvidencePayload {
  kind: "claim-evidence";
  choices: ChallengeChoice[];
  claimEvidenceId: string;
  /** Literal support can be scored; qualified, limited, and unresolved links remain Explore. */
  relationship: "supports" | "qualifies" | "scope-limits" | "unresolved";
}

export interface PaperCheckPayload {
  kind: "paper-check";
  choices: ChallengeChoice[];
  category: "terminology" | "method" | "evidence" | "result";
}

export interface PaperVsPaperPayload {
  kind: "paper-vs-paper";
  choices: ChallengeChoice[];
  paperLabels: Record<string, string>;
}

export interface TimelinePayload {
  kind: "timeline";
  items: ChallengeChoice[];
}

export interface EvolutionPayload {
  kind: "evolution";
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
  | EvidenceHuntPayload
  | FigureBuildPayload
  | FigureDetectivePayload
  | PredictionPayload
  | ClaimEvidencePayload
  | PaperCheckPayload
  | PaperVsPaperPayload
  | TimelinePayload
  | EvolutionPayload;

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

export type FigureBuildChallenge =
  | ScoredChallenge<"figure-build", FigureBuildPayload, OrderAnswer>
  | ExploreChallenge<"figure-build", FigureBuildPayload>;

export type FigureDetectiveChallenge =
  | ScoredChallenge<"figure-detective", FigureDetectivePayload, ChoiceAnswer>
  | ExploreChallenge<"figure-detective", FigureDetectivePayload>;

export type PredictionChallenge = ExploreChallenge<"prediction", PredictionPayload>;

export type ClaimEvidenceChallenge =
  | ScoredChallenge<"claim-evidence", ClaimEvidencePayload, ChoiceAnswer>
  | ExploreChallenge<"claim-evidence", ClaimEvidencePayload>;

export type PaperCheckChallenge =
  | ScoredChallenge<"paper-check", PaperCheckPayload, ChoiceAnswer>
  | ExploreChallenge<"paper-check", PaperCheckPayload>;

export type PaperVsPaperChallenge =
  | ScoredChallenge<"paper-vs-paper", PaperVsPaperPayload, ChoiceAnswer>
  | ExploreChallenge<"paper-vs-paper", PaperVsPaperPayload>;

export type TimelineChallenge =
  | ScoredChallenge<"timeline", TimelinePayload, OrderAnswer>
  | ExploreChallenge<"timeline", TimelinePayload>;

export type EvolutionChallenge =
  | ScoredChallenge<"evolution", EvolutionPayload, OrderAnswer>
  | ExploreChallenge<"evolution", EvolutionPayload>;

export type ChallengeSpec =
  | MultipleChoiceChallenge
  | ConceptMatchChallenge
  | OrderingChallenge
  | EvidenceHuntChallenge
  | FigureBuildChallenge
  | FigureDetectiveChallenge
  | PredictionChallenge
  | ClaimEvidenceChallenge
  | PaperCheckChallenge
  | PaperVsPaperChallenge
  | TimelineChallenge
  | EvolutionChallenge;

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
