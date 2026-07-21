"use client";

import { useMemo, useState } from "react";
import { evidenceKey, type SourceEvidence } from "../../lib/evidence/source";
import { sourceEvidenceHref } from "../../lib/evidence/navigation";
import { buildEvidenceGraph, buildEvidencePacket } from "../../lib/evidence-graph/evidence-graph";
import { inspectTensions } from "../../lib/evidence-graph/client";
import type { EvidencePacket, TensionCandidate } from "../../lib/evidence-graph/types";
import type { PaperAnalysis } from "../../lib/explore/analysis";
import { getPaperLearningIndex } from "../../lib/learning/paper-index";

function packetsFor(analysis: PaperAnalysis): EvidencePacket[] {
  const index = getPaperLearningIndex(analysis.manifest, analysis.pageItems.map((items, page) => ({ items, mentions: analysis.mentionsByPage[page] ?? [], citations: analysis.citationsByPage[page] ?? [] })));
  const graph = buildEvidenceGraph(index);
  return graph.nodes.filter((node) => node.type === "claim").flatMap((node) => {
    const packet = buildEvidencePacket(graph, node.id, index);
    return packet ? [packet] : [];
  });
}

function allSources(packet: EvidencePacket): SourceEvidence[] {
  return [packet.claimEvidence, ...packet.supportingEvidence, ...packet.reportedResults, ...packet.figures, ...packet.tables, ...packet.methods, ...packet.experiments, ...packet.datasetsAndBenchmarks, ...packet.comparators, ...packet.limitations, ...packet.citations];
}

export default function TensionInspector({ analyses }: { analyses: PaperAnalysis[] }) {
  const paperPackets = useMemo(() => analyses.map((analysis) => ({ analysis, packets: packetsFor(analysis) })).filter((item) => item.packets.length > 0), [analyses]);
  const [leftPaper, setLeftPaper] = useState(0);
  const [rightPaper, setRightPaper] = useState(1);
  const [leftClaim, setLeftClaim] = useState(0);
  const [rightClaim, setRightClaim] = useState(0);
  const [candidates, setCandidates] = useState<TensionCandidate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = paperPackets[leftPaper]?.packets[leftClaim];
  const right = paperPackets[rightPaper]?.packets[rightClaim];

  if (paperPackets.length < 2) return <section className="mt-6"><h2 className="text-xl font-semibold">Potential tensions and qualifications</h2><p className="mt-2 text-sm opacity-60">Add at least two locally available papers with conservative source claims to inspect evidence across papers.</p></section>;

  const run = async () => {
    if (!left || !right || left.paperId === right.paperId) return;
    setChecking(true); setError(null); setCandidates(null);
    try { setCandidates(await inspectTensions(left, right)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cross-paper inspection failed closed."); }
    finally { setChecking(false); }
  };

  const selectPaper = (side: "left" | "right", value: number) => {
    if (side === "left") { setLeftPaper(value); setLeftClaim(0); } else { setRightPaper(value); setRightClaim(0); }
    setCandidates(null);
  };

  return (
    <section className="mt-6" aria-labelledby="tension-heading">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Human inspection workflow</p><h2 id="tension-heading" className="mt-1 text-xl font-semibold">Potential tensions, agreements, and qualifications</h2><p className="mt-1 max-w-3xl text-sm opacity-65">Marginalia compares bounded verified packets. Semantic relationships are candidates—not claims that one paper disproves another.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["left", "right"] as const).map((side) => { const paperIndex = side === "left" ? leftPaper : rightPaper; const claimIndex = side === "left" ? leftClaim : rightClaim; const item = paperPackets[paperIndex]; return <fieldset key={side} className="rounded-xl border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><legend className="px-1 text-xs font-semibold uppercase">Paper {side === "left" ? "A" : "B"}</legend><label className="mt-2 block text-xs">Paper<select value={paperIndex} onChange={(event) => selectPaper(side, Number(event.target.value))} className="mt-1 min-h-10 w-full rounded border bg-transparent px-2">{paperPackets.map((entry, index) => <option key={entry.analysis.manifest.doc_id} value={index}>{entry.analysis.manifest.title}</option>)}</select></label><label className="mt-3 block text-xs">Canonical claim<select value={claimIndex} onChange={(event) => { side === "left" ? setLeftClaim(Number(event.target.value)) : setRightClaim(Number(event.target.value)); setCandidates(null); }} className="mt-1 min-h-24 w-full rounded border bg-transparent px-2 py-1">{item.packets.map((packet, index) => <option key={packet.id} value={index}>{packet.canonicalClaimText.slice(0, 180)}</option>)}</select></label></fieldset>; })}
      </div>
      <button type="button" disabled={checking || !left || !right || left.paperId === right.paperId} onClick={() => void run()} className="mt-4 min-h-11 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">{checking ? "Inspecting evidence from both papers…" : "Inspect evidence"}</button>
      {left?.paperId === right?.paperId && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Choose two different papers.</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {candidates && candidates.length === 0 && <p role="status" className="mt-4 rounded-lg border border-neutral-300 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">No careful candidate relationship was supported by evidence from both selected packets.</p>}
      {candidates && candidates.length > 0 && <ul className="mt-5 grid gap-4">{candidates.map((candidate) => { const sources = new Map([...(left ? allSources(left) : []), ...(right ? allSources(right) : [])].map((item) => [evidenceKey(item), item])); return <li key={candidate.id} className="rounded-xl border-2 border-dashed border-violet-500 bg-white p-4 dark:bg-neutral-900"><p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Candidate · generated/inferred · {candidate.relation}</p><p className="mt-2 text-sm leading-6">{candidate.reason}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Paper A evidence", candidate.paperAEvidenceIds], ["Paper B evidence", candidate.paperBEvidenceIds]].map(([label, ids]) => <div key={String(label)} className="rounded-lg border p-3"><h3 className="text-xs font-semibold">{label as string}</h3><ul className="mt-2 grid gap-1">{(ids as string[]).map((id) => { const source = sources.get(id); return source ? <li key={id}><a href={sourceEvidenceHref(source)} className="text-xs text-sky-700 underline decoration-dotted dark:text-sky-300">{source.kind} · page {source.page + 1} · exact source</a></li> : null; })}</ul></div>)}</div></li>; })}</ul>}
    </section>
  );
}
