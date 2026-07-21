export type MasteryState = "practicing" | "mastered";

export interface LearningProgress {
  version: 1;
  paperId: string;
  completedChallengeIds: string[];
  conceptMastery: Record<string, MasteryState>;
  currentSectionId?: string;
  updatedAt: number;
}

export interface ProgressRepository {
  getProgress(paperId: string): Promise<LearningProgress | null>;
  saveProgress(progress: LearningProgress): Promise<LearningProgress>;
}

export function emptyProgress(paperId: string, now = Date.now()): LearningProgress {
  return { version: 1, paperId, completedChallengeIds: [], conceptMastery: {}, updatedAt: now };
}

export function completeChallenge(
  progress: LearningProgress,
  challenge: { id: string; concepts: string[] },
  currentSectionId?: string,
  now = Date.now(),
): LearningProgress {
  return {
    ...progress,
    completedChallengeIds: [...new Set([...progress.completedChallengeIds, challenge.id])],
    conceptMastery: { ...progress.conceptMastery, ...Object.fromEntries(challenge.concepts.map((id) => [id, "mastered" as const])) },
    ...(currentSectionId ? { currentSectionId } : {}),
    updatedAt: now,
  };
}
