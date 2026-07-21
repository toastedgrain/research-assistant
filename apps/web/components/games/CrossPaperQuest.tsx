"use client";

import { useMemo } from "react";
import { createPaperVsPaperChallenge } from "../../lib/challenges/cross-paper";
import type { ChallengeEvidence } from "../../lib/challenges/contracts";
import type { EvidenceResolver } from "../../lib/evidence/resource";
import type { CrossPaperContextProvider } from "../../lib/explore/cross-paper-provider";
import ChallengeRendererShell from "./ChallengeRendererShell";

interface Props {
  provider: CrossPaperContextProvider;
  paperAId: string;
  paperBId: string;
  query: string;
  resolver?: EvidenceResolver;
  onNavigateEvidence?: (evidence: ChallengeEvidence) => void;
  onPinEvidence?: (evidence: ChallengeEvidence) => void;
}

/** Dev A game UI; it consumes Dev B's provider but never imports an exploration surface. */
export default function CrossPaperQuest({
  provider,
  paperAId,
  paperBId,
  query,
  resolver,
  onNavigateEvidence = () => undefined,
  onPinEvidence,
}: Props) {
  const challenge = useMemo(
    () => createPaperVsPaperChallenge(provider, paperAId, paperBId, query),
    [paperAId, paperBId, provider, query],
  );
  if (!resolver || !challenge) {
    return <p className="text-sm text-neutral-500">This comparison requires both loaded papers and direct, resolvable source evidence.</p>;
  }
  return <ChallengeRendererShell challenge={challenge} resolver={resolver} onNavigateEvidence={onNavigateEvidence} onPinEvidence={onPinEvidence} />;
}
