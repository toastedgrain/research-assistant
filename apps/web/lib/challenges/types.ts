/**
 * Compatibility entry point. Challenge contracts live in contracts.ts so every active
 * renderer and validator uses the discriminated scored/explore model.
 */
export type {
  ChallengeAnswer,
  ChallengeChoice,
  ChallengeDifficulty,
  ChallengeEvaluation,
  ChallengeEvidence,
  ChallengeHint,
  ChallengeLifecycle,
  ChallengeMode,
  ChallengePayload,
  ChallengeReturnRecord,
  ChallengeScoring,
  ChallengeSpec,
  ChallengeType,
  ConceptMatchChallenge,
  EvidenceHuntChallenge,
  EvidenceHuntPayload,
  ExploreChallenge,
  GenerationMetadata,
  GroundedRelationship,
  LearnerResponse,
  MultipleChoiceChallenge,
  OrderingChallenge,
  ScoredChallenge,
} from "./contracts";