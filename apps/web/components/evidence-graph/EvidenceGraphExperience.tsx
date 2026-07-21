"use client";

import { Bot, ChevronDown, LocateFixed, Pin, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { evidenceKey, type SourceEvidence } from "../../lib/evidence/source";
import { generateEvidenceGraphCandidates, investigateEvidencePacket } from "../../lib/evidence-graph/client";
import type { EvidencePacket, InvestigatorResult } from "../../lib/evidence-graph/types";
import type { ResearchGraph } from "../../lib/explore/graph";
import EvidenceGraphCanvas from "./EvidenceGraphCanvas";
import { createClaimEvidenceHunt, createClaimVsEvidenceGame, createReconstructExperimentGame } from "../../lib/evidence-graph/games";
import type { VisualChallengeSpec } from "../../lib/visual-learning/contracts";
import VisualChallengeCanvas from "../visual-learning/VisualChallengeCanvas";

function uniqueEvidence(packet: EvidencePacket): SourceEvidence[] {
  return [...new Map([
    packet.claimEvidence,
    ...packet.supportingEvidence,
    ...packet.reportedResults,
    ...packet.figures,
    ...packet.tables,
    ...packet.methods,
    ...packet.experiments,
    ...packet.datasetsAndBenchmarks,
    ...packet.comparators,
    ...packet.limitations,
    ...packet.citations,
  ].map((item) => [evidenceKey(item), item])).values()];
}

function sourceLabel(source: SourceEvidence): string {
  const detail = source.assetId ?? source.refId ?? source.text?.replace(/\s+/g, " ").slice(0, 120) ?? source.kind;
  return `${source.kind} · page ${source.page + 1} · ${detail}`;
}

interface Props {
  packet: EvidencePacket;
  onShowEvidence: (source: SourceEvidence, reason: string) => void;
  onPinPacket?: (packet: EvidencePacket) => void;
  onFocusPaper?: () => void;
  selectedEvidenceId?: string;
  forceReducedMotion?: boolean;
}

export default function EvidenceGraphExperience({ packet, onShowEvidence, onPinPacket, onFocusPaper = () => undefined, selectedEvidenceId, forceReducedMotion }: Props) {
  const [graph, setGraph] = useState<ResearchGraph>(packet.graph);
  const [candidateStatus, setCandidateStatus] = useState<"checking" | "ready" | "unavailable">("checking");
  const [packetOpen, setPacketOpen] = useState(false);
  const [question, setQuestion] = useState("Why do the authors believe this works?");
  const [investigation, setInvestigation] = useState<InvestigatorResult | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [showReasoningSources, setShowReasoningSources] = useState(false);
  const [game, setGame] = useState<VisualChallengeSpec | null>(null);
  const sources = useMemo(() => uniqueEvidence(packet), [packet]);
  const sourceById = useMemo(() => new Map(sources.map((item) => [evidenceKey(item), item])), [sources]);
  const evidenceGames = useMemo(() => [createClaimVsEvidenceGame(packet), createReconstructExperimentGame(packet), createClaimEvidenceHunt(packet)].filter((item): item is VisualChallengeSpec => Boolean(item)), [packet]);

  useEffect(() => {
    const controller = new AbortController();
    generateEvidenceGraphCandidates(packet.graph, { signal: controller.signal }).then((next) => {
      setGraph(next);
      setCandidateStatus("ready");
    }).catch(() => setCandidateStatus("unavailable"));
    return () => controller.abort();
  }, [packet]);

  const runInvestigator = async () => {
    if (!question.trim()) return;
    setInvestigating(true);
    setInvestigation(null);
    setShowReasoningSources(false);
    try {
      setInvestigation(await investigateEvidencePacket(question, packet));
    } catch (error) {
      setInvestigation({ status: "insufficient-evidence", reason: error instanceof Error ? error.message : "The investigator failed closed." });
    } finally {
      setInvestigating(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
        <div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">Canonical source claim</p><blockquote className="mt-2 text-base font-semibold leading-6">“{packet.canonicalClaimText}”</blockquote><p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">Support status: {packet.supportStatus}. This describes indexed source relationships—not scientific truth.</p></div>
        <div className="flex gap-2">
          {onPinPacket && <button type="button" onClick={() => onPinPacket(packet)} className="flex min-h-10 items-center gap-1.5 rounded-md border border-sky-700 bg-white px-3 text-xs font-semibold text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-neutral-950 dark:text-sky-300"><Pin aria-hidden="true" size={14} />Pin evidence chain</button>}
          <button type="button" onClick={() => setPacketOpen((open) => !open)} aria-expanded={packetOpen} className="flex min-h-10 items-center gap-1.5 rounded-md border border-sky-700 bg-white px-3 text-xs font-semibold text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-neutral-950 dark:text-sky-300"><ShieldCheck aria-hidden="true" size={14} />Evidence Packet<ChevronDown aria-hidden="true" size={14} /></button>
        </div>
      </div>

      <EvidenceGraphCanvas graph={graph} rootId={packet.claimNodeId} forceReducedMotion={forceReducedMotion} onShowEvidence={(source) => onShowEvidence(source, "Evidence graph node selected")} />
      <p role="status" className="text-xs text-neutral-500">{candidateStatus === "checking" ? "Checking bounded evidence for optional generated candidate relationships…" : candidateStatus === "ready" ? "Literal relationships remain solid; any model-assisted candidates are dashed and labeled generated." : "Candidate generation unavailable. The literal deterministic graph remains usable."}</p>

      {evidenceGames.length > 0 && <section className="rounded-2xl border border-emerald-300 bg-white p-4 dark:border-emerald-900 dark:bg-neutral-950" aria-labelledby="evidence-games-heading"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Evidence reasoning games</p><h2 id="evidence-games-heading" className="mt-1 text-base font-semibold">Manipulate the evidence architecture</h2><div className="mt-3 flex flex-wrap gap-2">{evidenceGames.map((item) => <button key={item.id} type="button" onClick={() => setGame(item)} className="min-h-10 rounded-md border border-emerald-700 px-3 text-xs font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300">{item.title}</button>)}</div></section>}
      {game && <section aria-label={`${game.title} evidence reasoning game`}><div className="mb-2 flex justify-end"><button type="button" onClick={() => setGame(null)} className="min-h-9 rounded-md border px-3 text-xs">Close game</button></div><VisualChallengeCanvas spec={game} onShowEvidence={(id) => { const source = sourceById.get(id); if (source) onShowEvidence(source, `${game.title} source evidence`); }} onFocusPaper={onFocusPaper} selectedEvidenceId={selectedEvidenceId} onComplete={() => undefined} /></section>}

      {packetOpen && (
        <section className="rounded-2xl border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950" aria-label="Evidence Packet">
          <h2 className="text-base font-semibold">Evidence Packet</h2>
          <p className="mt-1 text-xs text-neutral-500">Verified source pointers are preserved separately from interpretation.</p>
          {packet.missingSources.length > 0 && <div className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs dark:bg-amber-950/30"><strong>Unavailable source pointers:</strong> {packet.missingSources.join(" ")}</div>}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{sources.map((source) => <li key={evidenceKey(source)} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-[10px] font-semibold uppercase text-neutral-500">Source · {source.kind}</p><p className="mt-1 text-xs leading-5">{sourceLabel(source)}</p><button type="button" onClick={() => onShowEvidence(source, "Evidence Packet source selected")} className="mt-2 flex min-h-8 items-center gap-1 text-xs font-medium text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-sky-300"><LocateFixed aria-hidden="true" size={13} />Show exact source</button></li>)}</ul>
        </section>
      )}

      <section className="rounded-2xl border border-violet-300 bg-white p-4 dark:border-violet-800 dark:bg-neutral-950" aria-labelledby="investigator-title">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300"><Search aria-hidden="true" size={13} />Marginalia Research Investigator</p>
        <h2 id="investigator-title" className="mt-1 text-base font-semibold">Investigate the evidence chain</h2>
        <p className="mt-1 text-xs text-neutral-500">The investigator answers from this verified packet—not general model memory.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="investigator-question">Research question</label><input id="investigator-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runInvestigator(); }} className="min-h-11 flex-1 rounded-md border border-neutral-300 bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-neutral-700" /><button type="button" disabled={investigating || !question.trim()} onClick={() => void runInvestigator()} className="min-h-11 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">Investigate</button></div>
        {investigating && <div role="status" className="mt-4 grid gap-1 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs dark:border-violet-900 dark:bg-violet-950/30"><span>Locating claims in the bounded graph…</span><span>Inspecting verified figures, tables, methods, results, and qualifications…</span><span>Building a source-grounded interpretation…</span></div>}
        {investigation?.status === "insufficient-evidence" && <p role="status" className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">{investigation.reason}</p>}
        {investigation?.status === "ready" && investigation.interpretation && (
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300"><ShieldCheck aria-hidden="true" size={13} />Source facts</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{investigation.interpretation.evidenceIds.map((id) => { const source = sourceById.get(id); return source ? <li key={id}><button type="button" onClick={() => onShowEvidence(source, "Investigator source fact selected")} className="text-left underline decoration-dotted underline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600">{sourceLabel(source)}</button></li> : null; })}</ul></div>
            <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300"><Bot aria-hidden="true" size={13} />Interpretation · AI generated</p><p className="mt-2 text-sm leading-6">{investigation.interpretation.text}</p>{investigation.interpretation.qualifications.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{investigation.interpretation.qualifications.map((item) => <li key={item}>{item}</li>)}</ul>}{investigation.interpretation.uncertainty && <p className="mt-2 text-xs"><strong>Uncertainty:</strong> {investigation.interpretation.uncertainty}</p>}</div>
            <button type="button" aria-expanded={showReasoningSources} onClick={() => setShowReasoningSources((shown) => !shown)} className="flex min-h-10 w-fit items-center gap-1.5 rounded-md border border-violet-700 px-3 text-xs font-semibold text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-violet-300"><Sparkles aria-hidden="true" size={14} />WHY? / Show reasoning sources</button>
            {showReasoningSources && <ol className="grid gap-2 border-l-2 border-violet-300 pl-4 text-sm" aria-label="Structured evidence path"><li><strong>AI interpretation</strong> (generated)</li><li><strong>Canonical claim</strong>: {packet.canonicalClaimText}</li>{investigation.interpretation.evidenceIds.map((id) => { const source = sourceById.get(id); return source ? <li key={id}><button type="button" onClick={() => onShowEvidence(source, "Structured reasoning source selected")} className="text-left text-sky-700 underline decoration-dotted dark:text-sky-300">{sourceLabel(source)}</button></li> : null; })}<li><strong>Original source</strong>: open any item above. This is provenance, not hidden model chain-of-thought.</li></ol>}
          </div>
        )}
      </section>
    </div>
  );
}
