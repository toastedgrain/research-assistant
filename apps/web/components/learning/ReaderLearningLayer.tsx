"use client";

import { ArrowLeft, LocateFixed, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { challengeEvidence, type ChallengeEvidence, type ChallengeReturnRecord, type ChallengeSpec } from "../../lib/challenges/contracts";
import { createEvidenceHunt } from "../../lib/challenges/evidence-hunt";
import { createChallengeReturnRecord, evidenceForDetails } from "../../lib/challenges/session";
import type { EvidenceResolver } from "../../lib/evidence/resource";
import { evidenceKey, isSourceEvidence, passageEvidence } from "../../lib/evidence/source";
import type { PaperLearningIndex } from "../../lib/learning/paper-index";
import { buildLearningObjects } from "../../lib/learning/objects";
import { createConceptMatch, createFigureBuild, createQuestPlan, createQuickQuiz } from "../../lib/challenges/generator";
import { IndexedDbProgressRepository } from "../../lib/progress/indexed-db";
import { completeChallenge, emptyProgress, type LearningProgress } from "../../lib/progress/types";
import type { ResearchContext, SelectionContext } from "../../lib/research-context/types";
import type { CapturedSelection } from "../../lib/selection/dom";
import ChallengeRendererShell from "../games/ChallengeRendererShell";
import SelectionMenu from "../selection/SelectionMenu";
import LearningModes, { type LearningModeRequest } from "./LearningModes";
import VisualLearningExperience from "../visual-learning/VisualLearningExperience";
import EvidenceGraphExperience from "../evidence-graph/EvidenceGraphExperience";
import { buildEvidenceGraph, buildEvidencePacket, claimForSelection } from "../../lib/evidence-graph/evidence-graph";
import type { EvidencePacket } from "../../lib/evidence-graph/types";
import { IndexedDbWorkspaceRepository } from "../../lib/workspace/indexed-db";
import { pinEvidencePacket } from "../../lib/workspace/pinning";

interface Props {
  selection: (CapturedSelection & { menuOpen: boolean }) | null;
  context: ResearchContext | null;
  index: PaperLearningIndex | null;
  resolver: EvidenceResolver | null;
  onSelectionMenuOpenChange: (open: boolean) => void;
  onOpenContext: () => void;
  onOpenTrace: () => void;
  onPin: () => void;
  onCopy: () => void;
  onNavigateEvidence: (evidence: ChallengeEvidence) => void;
  onPinEvidence: (evidence: ChallengeEvidence) => void;
  onFocusPaper: () => void;
  onRestorePaperPage: (page: number) => void;
}

function evidenceDescription(evidence: ChallengeEvidence, resolver: EvidenceResolver | null): string {
  const resolved = resolver?.resolve(evidence);
  const location = isSourceEvidence(evidence.source) ? `page ${evidence.source.page + 1}` : "paper metadata";
  if (resolved?.status === "resolved") {
    return [resolved.label, location, resolved.section?.title, resolved.excerpt]
      .filter(Boolean)
      .join(" Â· ");
  }
  return `${evidence.source.kind} Â· ${location}`;
}

/**
 * Keeps learning state adjacent to Reader without turning Reader into a game controller.
 * The paper remains visible while a compact interaction is open.
 */
export default function ReaderLearningLayer({
  selection,
  context,
  index,
  resolver,
  onSelectionMenuOpenChange,
  onOpenContext,
  onOpenTrace,
  onPin,
  onCopy,
  onNavigateEvidence,
  onPinEvidence,
  onFocusPaper,
  onRestorePaperPage,
}: Props) {
  const [challenge, setChallenge] = useState<ChallengeSpec | null>(null);
  const [huntSelection, setHuntSelection] = useState<SelectionContext | undefined>();
  const [returnRecord, setReturnRecord] = useState<ChallengeReturnRecord | undefined>();
  const [view, setView] = useState<"challenge" | "evidence">("challenge");
  const [returnPage, setReturnPage] = useState<number | undefined>();
  const [clickedEvidence, setClickedEvidence] = useState<ChallengeEvidence | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [learningRequest, setLearningRequest] = useState<LearningModeRequest | undefined>();
  const [visualExperience, setVisualExperience] = useState<{ kind: "visualize" | "game" | "quest"; context: ResearchContext } | null>(null);
  const [visualEvidenceOpen, setVisualEvidenceOpen] = useState(false);
  const [visualPaperFocus, setVisualPaperFocus] = useState(false);
  const [tracePacket, setTracePacket] = useState<EvidencePacket | null>(null);
  const [traceEvidenceOpen, setTraceEvidenceOpen] = useState(false);
  const [tracePaperFocus, setTracePaperFocus] = useState(false);
  const [tracePinStatus, setTracePinStatus] = useState("");
  const ignoredSelection = useRef<SelectionContext | undefined>(undefined);
  const progressRepository = useMemo(() => new IndexedDbProgressRepository(), []);
  const workspaceRepository = useMemo(() => new IndexedDbWorkspaceRepository(), []);
  const questPlan = useMemo(() => index ? createQuestPlan(index, buildLearningObjects(index)) : null, [index]);
  const evidenceGraph = useMemo(() => index ? buildEvidenceGraph(index) : null, [index]);
  const traceClaimCandidate = useMemo(() => {
    if (!evidenceGraph || !context?.selection) return null;
    return claimForSelection(evidenceGraph, context.selection.text, context.selection.page);
  }, [context?.selection, evidenceGraph]);
  const completedChallengeIds = useMemo(() => new Set(progress?.completedChallengeIds ?? []), [progress]);

  useEffect(() => {
    let cancelled = false;
    if (!index) { setProgress(null); return; }
    progressRepository.getProgress(index.paperId).then((stored) => {
      if (!cancelled) setProgress(stored ?? emptyProgress(index.paperId));
    });
    return () => { cancelled = true; };
  }, [index, progressRepository]);

  const recordCompletion = useCallback((record: ChallengeReturnRecord) => {
    if (record.lifecycle !== "complete" || !challenge || !index) return;
    const sectionId = questPlan?.checkpoints.find((checkpoint) => checkpoint.challenges.some(({ id }) => id === challenge.id))?.sectionId;
    setProgress((current) => {
      const base = current ?? emptyProgress(index.paperId);
      if (base.completedChallengeIds.includes(record.challengeId)) return base;
      const next = completeChallenge(base, challenge, sectionId);
      void progressRepository.saveProgress(next);
      return next;
    });
  }, [challenge, index, progressRepository, questPlan]);

  const handleChallengeStateChange = useCallback((record: ChallengeReturnRecord) => {
    setReturnRecord(record);
    recordCompletion(record);
  }, [recordCompletion]);

  useEffect(() => {
    const next = selection?.context;
    if (!challenge || !next || next === ignoredSelection.current) return;
    setHuntSelection(next);
  }, [challenge, selection?.context]);

  const startEvidenceHunt = () => {
    if (!context || !index) return;
    const next = createEvidenceHunt(context, index);
    if (!next) return;
    ignoredSelection.current = selection?.context;
    setChallenge(next);
    setHuntSelection(undefined);
    setReturnRecord(undefined);
    setView("challenge");
    setClickedEvidence(null);
    onSelectionMenuOpenChange(false);
  };

  const startChallenge = (next: ChallengeSpec) => {
    setChallenge(next);
    setHuntSelection(undefined);
    setReturnRecord(undefined);
    setView("challenge");
    setClickedEvidence(null);
  };

  const startVisualExperience = (kind: "visualize" | "game" | "quest") => {
    if (!context || !index || !resolver) return;
    setVisualExperience({ kind, context });
    setVisualEvidenceOpen(false);
    setVisualPaperFocus(false);
    setClickedEvidence(null);
    onSelectionMenuOpenChange(false);
  };

  const startTraceClaim = () => {
    if (!index || !evidenceGraph || !traceClaimCandidate) return;
    const packet = buildEvidencePacket(evidenceGraph, traceClaimCandidate.id, index);
    if (!packet) return;
    setTracePacket(packet);
    setTraceEvidenceOpen(false);
    setTracePaperFocus(false);
    setClickedEvidence(null);
    onSelectionMenuOpenChange(false);
  };

  const pinTracePacket = async (packet: EvidencePacket) => {
    if (!index) return;
    const result = await pinEvidencePacket(workspaceRepository, index.manifest, packet);
    setTracePinStatus(result.status === "pinned" ? "Verified evidence chain pinned to Workspace." : result.reason);
  };

  const startDeterministicFallback = () => {
    if (!index) return;
    const objects = buildLearningObjects(index);
    const next = createFigureBuild(index, objects) ?? createConceptMatch(index, objects) ?? createQuickQuiz(index, objects);
    if (!next) return;
    setVisualExperience(null);
    setVisualEvidenceOpen(false);
    startChallenge(next);
  };

  const recordGeneratedCompletion = (challengeId: string) => {
    if (!index) return;
    setProgress((current) => {
      const base = current ?? emptyProgress(index.paperId);
      if (base.completedChallengeIds.includes(challengeId)) return base;
      const next = completeChallenge(
        base,
        { id: challengeId, concepts: visualExperience?.context.concepts.map((item) => item.conceptId) ?? [] },
        visualExperience?.context.section?.sectionId,
      );
      void progressRepository.saveProgress(next);
      return next;
    });
  };

  const closeChallenge = () => {
    setChallenge(null);
    setView("challenge");
    setReturnRecord(undefined);
    setClickedEvidence(null);
    onFocusPaper();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (traceEvidenceOpen) {
        event.stopImmediatePropagation();
        setTraceEvidenceOpen(false);
        return;
      }
      if (tracePaperFocus) {
        event.stopImmediatePropagation();
        setTracePaperFocus(false);
        return;
      }
      if (tracePacket) {
        event.stopImmediatePropagation();
        setTracePacket(null);
        onFocusPaper();
        return;
      }
      if (visualEvidenceOpen) {
        event.stopImmediatePropagation();
        setVisualEvidenceOpen(false);
        return;
      }
      if (visualPaperFocus) {
        event.stopImmediatePropagation();
        setVisualPaperFocus(false);
        return;
      }
      if (visualExperience) {
        event.stopImmediatePropagation();
        setVisualExperience(null);
        onFocusPaper();
        return;
      }
      if (view === "evidence") {
        event.stopImmediatePropagation();
        backToChallenge();
        return;
      }
      if (challenge) {
        event.stopImmediatePropagation();
        closeChallenge();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [challenge, onFocusPaper, traceEvidenceOpen, tracePacket, tracePaperFocus, view, visualEvidenceOpen, visualExperience, visualPaperFocus]);

  useEffect(() => {
    if (!visualPaperFocus || !context?.selection || !visualExperience) return;
    if (context.selection.text !== visualExperience.context.selection?.text || context.selection.page !== visualExperience.context.selection?.page) {
      setVisualPaperFocus(false);
    }
  }, [context, visualExperience, visualPaperFocus]);

  const showEvidence = (evidence: ChallengeEvidence) => {
    if (challenge && returnRecord) setReturnRecord(createChallengeReturnRecord(returnRecord));
    setReturnPage(huntSelection?.page ?? selection?.context.page);
    setView("evidence");
    setClickedEvidence(evidence);
    onNavigateEvidence(evidence);
  };

  const showVisualEvidence = (evidence: ChallengeEvidence) => {
    setClickedEvidence(evidence);
    setVisualEvidenceOpen(true);
    onNavigateEvidence(evidence);
  };

  const showTraceEvidence = (source: Parameters<typeof challengeEvidence>[0], reason: string) => {
    const evidence = challengeEvidence(source, reason, ...(isSourceEvidence(source) && source.kind === "citation" && source.refId ? [{ kind: "citation" as const, resourceId: source.refId }] : []));
    setClickedEvidence(evidence);
    setTraceEvidenceOpen(true);
    onNavigateEvidence(evidence);
  };

  const backToChallenge = () => {
    setView("challenge");
    if (returnPage !== undefined) onRestorePaperPage(returnPage);
    window.requestAnimationFrame(() => {
      const id = returnRecord?.focusTargetId ?? (challenge ? `challenge-${challenge.id}` : undefined);
      if (id) document.getElementById(id)?.focus();
    });
  };

  const defaultEvidence = challenge?.mode === "scored" && challenge.answer.kind === "evidence-hunt"
    ? challenge.answer.acceptedEvidenceIds
      .map((id) => challenge.evidence.find((item) => item.id === id))
      .find((item): item is ChallengeEvidence => Boolean(item))
    : challenge?.evidence[0];
  const activeEvidence = evidenceForDetails(clickedEvidence, defaultEvidence);
  const traceSelectedEvidenceId = context?.sourceWindow.selected && index ? evidenceKey(passageEvidence(index.paperId, context.sourceWindow.selected.page, context.sourceWindow.selected.text, { ...(context.sourceWindow.selected.bbox ? { bbox: context.sourceWindow.selected.bbox } : {}), ...(context.sourceWindow.selected.sectionId ? { sectionId: context.sourceWindow.selected.sectionId } : {}) })) : undefined;

  return (
    <>
      {selection?.menuOpen && (
        <SelectionMenu
          anchor={selection.anchor}
          onPin={context?.sourceWindow.selected ? onPin : undefined}
          onEvidenceHunt={context && index ? startEvidenceHunt : undefined}
          onContext={onOpenContext}
          onTrace={onOpenTrace}
          onTraceClaim={traceClaimCandidate ? startTraceClaim : undefined}
          onUnderstand={() => {
            onSelectionMenuOpenChange(false);
            setLearningRequest("understand");
          }}
          onVisualize={() => {
            onSelectionMenuOpenChange(false);
            setLearningRequest("visualize");
          }}
          onPlay={() => {
            onSelectionMenuOpenChange(false);
            setLearningRequest("play");
          }}
          onCopy={onCopy}
          onClose={() => onSelectionMenuOpenChange(false)}
        />
      )}

      {challenge && view === "challenge" && index && resolver && (
        <aside className="fixed bottom-4 left-4 z-40 max-h-[min(560px,calc(100vh-32px))] w-[min(430px,calc(100vw-32px))] max-md:inset-x-3 max-md:bottom-3 max-md:w-auto overflow-y-auto">
          <div className="flex justify-end bg-white px-2 pt-2 shadow-lg dark:bg-neutral-950">
            <button
              type="button"
              onClick={closeChallenge}
              aria-label="Close learning interaction"
              className="flex h-8 w-8 items-center justify-center hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-sky-600 dark:hover:bg-neutral-800"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <ChallengeRendererShell
            challenge={challenge}
            resolver={resolver}
            evidenceHuntContext={{ index, selection: huntSelection }}
            initialReturnRecord={returnRecord}
            onFocusPaper={onFocusPaper}
            onNavigateEvidence={showEvidence}
            onPinEvidence={onPinEvidence}
            onChallengeStateChange={handleChallengeStateChange}
          />
        </aside>
      )}

      {challenge && view === "evidence" && activeEvidence && (
        <aside className="fixed bottom-4 left-4 z-40 w-[min(430px,calc(100vw-32px))] max-md:inset-x-3 max-md:bottom-3 max-md:w-auto border border-neutral-300 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase text-neutral-500">Source evidence</p>
          <p className="mt-2 text-sm leading-6">{evidenceDescription(activeEvidence, resolver)}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{activeEvidence.reason}</p>
          <button
            type="button"
            onClick={backToChallenge}
            className="mt-4 flex min-h-9 items-center gap-1.5 border border-sky-700 px-3 text-sm text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            Back to challenge
          </button>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
            <LocateFixed aria-hidden="true" size={14} />
            The matching source is highlighted in the paper.
          </p>
        </aside>
      )}

      {visualExperience && !visualEvidenceOpen && !visualPaperFocus && index && resolver && (
        <aside className="fixed inset-3 z-50 overflow-y-auto rounded-2xl bg-neutral-100/98 p-3 shadow-2xl backdrop-blur md:inset-6 md:p-5 dark:bg-neutral-900/98" aria-label="Visual learning experience">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Marginalia visual learning</p>
              <button type="button" onClick={() => { setVisualExperience(null); setVisualEvidenceOpen(false); onFocusPaper(); }} aria-label="Close visual learning experience" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-neutral-700 dark:bg-neutral-950"><X aria-hidden="true" size={17} /></button>
            </div>
            <VisualLearningExperience
              kind={visualExperience.kind}
              context={visualExperience.context}
              currentContext={context}
              index={index}
              resolver={resolver}
              onNavigateEvidence={showVisualEvidence}
              onFocusPaper={() => { setVisualPaperFocus(true); onFocusPaper(); }}
              onUseDeterministicFallback={startDeterministicFallback}
              onGeneratedChallengeComplete={recordGeneratedCompletion}
            />
          </div>
        </aside>
      )}

      {visualExperience && visualPaperFocus && (
        <button type="button" onClick={() => setVisualPaperFocus(false)} className="fixed bottom-4 left-4 z-50 min-h-11 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
          Return to visual game
        </button>
      )}

      {visualExperience && visualEvidenceOpen && clickedEvidence && (
        <aside className="fixed bottom-4 left-4 z-50 w-[min(430px,calc(100vw-32px))] rounded-xl border border-neutral-300 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase text-neutral-500">Visual source evidence</p>
          <p className="mt-2 text-sm leading-6">{evidenceDescription(clickedEvidence, resolver)}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{clickedEvidence.reason}</p>
          <button type="button" onClick={() => setVisualEvidenceOpen(false)} className="mt-4 flex min-h-9 items-center gap-1.5 rounded-md border border-violet-700 px-3 text-sm text-violet-800 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:bg-violet-950">
            <ArrowLeft aria-hidden="true" size={15} /> Back to visual
          </button>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500"><LocateFixed aria-hidden="true" size={14} />The exact source is highlighted in the paper.</p>
        </aside>
      )}

      {tracePacket && !traceEvidenceOpen && !tracePaperFocus && (
        <aside className="fixed inset-3 z-50 overflow-y-auto rounded-2xl bg-neutral-100/98 p-3 shadow-2xl backdrop-blur md:inset-6 md:p-5 dark:bg-neutral-900/98" aria-label="Claim evidence investigation">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Marginalia evidence architecture</p><button type="button" onClick={() => { setTracePacket(null); onFocusPaper(); }} aria-label="Close claim evidence investigation" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-neutral-700 dark:bg-neutral-950"><X aria-hidden="true" size={17} /></button></div>
            <EvidenceGraphExperience packet={tracePacket} onShowEvidence={showTraceEvidence} onPinPacket={(packet) => void pinTracePacket(packet)} selectedEvidenceId={traceSelectedEvidenceId} onFocusPaper={() => { setTracePaperFocus(true); onFocusPaper(); }} />
            <p aria-live="polite" className="mt-2 text-xs text-neutral-500">{tracePinStatus}</p>
          </div>
        </aside>
      )}

      {tracePacket && tracePaperFocus && <button type="button" onClick={() => setTracePaperFocus(false)} className="fixed bottom-4 left-4 z-50 min-h-11 rounded-full bg-sky-700 px-4 text-sm font-semibold text-white shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">Return to evidence investigation</button>}

      {tracePacket && traceEvidenceOpen && clickedEvidence && (
        <aside className="fixed bottom-4 left-4 z-50 w-[min(430px,calc(100vw-32px))] rounded-xl border border-neutral-300 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-xs font-medium uppercase text-neutral-500">Evidence graph source</p><p className="mt-2 text-sm leading-6">{evidenceDescription(clickedEvidence, resolver)}</p><p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{clickedEvidence.reason}</p>
          <button type="button" onClick={() => setTraceEvidenceOpen(false)} className="mt-4 flex min-h-9 items-center gap-1.5 rounded-md border border-sky-700 px-3 text-sm text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-sky-300"><ArrowLeft aria-hidden="true" size={15} />Back to evidence graph</button><p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500"><LocateFixed aria-hidden="true" size={14} />The exact source is highlighted in the paper.</p>
        </aside>
      )}

      <LearningModes
        index={index}
        resolver={resolver}
        context={context}
        completedChallengeIds={completedChallengeIds}
        progress={progress}
        onStartChallenge={startChallenge}
        onStartVisualLearning={() => startVisualExperience("visualize")}
        onStartVisualGame={(mode) => startVisualExperience(mode === "quest" ? "quest" : "game")}
        onTrace={onOpenTrace}
        requestedAction={learningRequest}
        onRequestedActionHandled={() => setLearningRequest(undefined)}
      />
    </>
  );
}
