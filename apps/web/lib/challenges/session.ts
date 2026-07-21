import type {
  ChallengeLifecycle,
  ChallengeReturnRecord,
  ChallengeSpec,
  LearnerResponse,
} from "./contracts";

export interface ChallengeSessionState {
  challengeId: string;
  lifecycle: ChallengeLifecycle;
  response: LearnerResponse;
  position?: number;
  focusTargetId?: string;
}

/** A serializable return record: evidence navigation never needs to recreate a blank game. */
export function createChallengeReturnRecord(state: ChallengeSessionState): ChallengeReturnRecord {
  return {
    challengeId: state.challengeId,
    lifecycle: state.lifecycle,
    response: state.response,
    ...(state.position === undefined ? {} : { position: state.position }),
    ...(state.focusTargetId ? { focusTargetId: state.focusTargetId } : {}),
  };
}

export function restoresChallenge(
  challenge: ChallengeSpec,
  record: ChallengeReturnRecord | null | undefined,
): record is ChallengeReturnRecord {
  return Boolean(record && record.challengeId === challenge.id && record.response.kind === challenge.answer?.kind);
}
