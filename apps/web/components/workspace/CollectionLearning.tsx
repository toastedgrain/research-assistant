"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCrossPaperConceptQuest,
  createEvolutionChallenge,
  createTimelineChallenge,
} from "../../lib/challenges/cross-paper";
import type { ChallengeEvidence } from "../../lib/challenges/contracts";
import { assetEvidence, isSourceEvidence, paperIdOf } from "../../lib/evidence/source";
import { sourceEvidenceHref } from "../../lib/evidence/navigation";
import type { PaperAnalysis } from "../../lib/explore/analysis";
import type { CitationGraphModel } from "../../lib/explore/citation-graph";
import { buildPaperTimeline } from "../../lib/explore/research-views";
import { createCrossPaperRuntime } from "../../lib/integration/cross-paper-runtime";
import { IndexedDbWorkspaceRepository } from "../../lib/workspace/indexed-db";
import { pinVerifiedEvidence } from "../../lib/workspace/pinning";
import type { ResearchCollection } from "../../lib/workspace/types";
import ChallengeRendererShell from "../games/ChallengeRendererShell";
import CrossPaperQuest from "../games/CrossPaperQuest";

type CrossMode = "paper-vs-paper" | "concept-quest" | "timeline" | "evolution";

function candidateTerms(analysis: PaperAnalysis): Set<string> {
  const text = analysis.manifest.assets.map((asset) => `${asset.label} ${asset.caption ?? ""}`).join(" ").toLocaleLowerCase();
  const ignored = new Set(["figure", "table", "with", "from", "that", "this", "using", "model", "results", "shown"]);
  return new Set((text.match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((term) => !ignored.has(term)));
}

function commonAssetTerm(left?: PaperAnalysis, right?: PaperAnalysis): string {
  if (!left || !right) return "";
  const rightTerms = candidateTerms(right);
  return [...candidateTerms(left)].find((term) => rightTerms.has(term)) ?? "";
}

export default function CollectionLearning({
  collection,
  analyses,
  citationModel,
}: {
  collection: ResearchCollection;
  analyses: PaperAnalysis[];
  citationModel: CitationGraphModel;
}) {
  const runtime = useMemo(() => createCrossPaperRuntime(analyses, collection, citationModel), [analyses, citationModel, collection]);
  const papers = runtime.crossPaper.getCollectionPapers(collection.id).filter((paper) => analyses.some((analysis) => paperIdOf(analysis.manifest) === paper.paperId));
  const [paperAId, setPaperAId] = useState("");
  const [paperBId, setPaperBId] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<CrossMode>("paper-vs-paper");
  const [pinStatus, setPinStatus] = useState("");
  const repository = useMemo(() => new IndexedDbWorkspaceRepository(), []);

  useEffect(() => {
    const first = papers[0]?.paperId ?? "";
    const second = papers.find((paper) => paper.paperId !== first)?.paperId ?? "";
    if (!paperAId || !papers.some((paper) => paper.paperId === paperAId)) setPaperAId(first);
    if (!paperBId || paperBId === first || !papers.some((paper) => paper.paperId === paperBId)) setPaperBId(second);
  }, [paperAId, paperBId, papers]);

  useEffect(() => {
    if (query) return;
    const left = analyses.find((analysis) => paperIdOf(analysis.manifest) === paperAId);
    const right = analyses.find((analysis) => paperIdOf(analysis.manifest) === paperBId);
    setQuery(commonAssetTerm(left, right));
  }, [analyses, paperAId, paperBId, query]);

  const timeline = useMemo(() => createTimelineChallenge(runtime.crossPaper, buildPaperTimeline(analyses)), [analyses, runtime]);
  const evolution = useMemo(() => createEvolutionChallenge(analyses.flatMap((analysis) => {
    const asset = analysis.manifest.assets.find((candidate) => candidate.kind === "figure");
    return asset ? [{ id: `${paperIdOf(analysis.manifest)}:${asset.asset_id}`, label: `${analysis.manifest.title}: ${asset.label}`, evidence: assetEvidence(paperIdOf(analysis.manifest), asset) }] : [];
  })), [analyses]);
  const conceptQuest = useMemo(
    () => createCrossPaperConceptQuest(runtime.crossPaper, paperAId, paperBId, query)?.challenges[0] ?? null,
    [paperAId, paperBId, query, runtime],
  );

  const navigate = (item: ChallengeEvidence) => window.location.assign(sourceEvidenceHref(item.source));
  const pin = async (item: ChallengeEvidence) => {
    if (!isSourceEvidence(item.source)) {
      setPinStatus("Bibliographic metadata is not stored as page evidence.");
      return;
    }
    const manifest = analyses.find((analysis) => paperIdOf(analysis.manifest) === item.source.paperId)?.manifest;
    if (!manifest) {
      setPinStatus("The source paper is unavailable locally.");
      return;
    }
    const result = await pinVerifiedEvidence(repository, manifest, item.source);
    setPinStatus(result.status === "pinned" ? "Verified evidence pinned to Workspace." : result.reason);
  };

  if (papers.length < 2) {
    return <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Add at least two locally available papers to this collection to start a cross-paper activity.</p>;
  }

  const selectedChallenge = mode === "timeline" ? timeline : mode === "evolution" ? evolution : mode === "concept-quest" ? conceptQuest : null;
  return (
    <section className="mt-6" aria-labelledby="cross-paper-learning-heading">
      <h2 id="cross-paper-learning-heading" className="text-xl font-semibold">Cross-paper learning</h2>
      <p className="mt-1 max-w-3xl text-sm opacity-65">Choose two loaded papers. Correctness is available only for literal source artifacts or verified publication chronology; unsupported evolution stays Explore-only.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Paper A<select value={paperAId} onChange={(event) => setPaperAId(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">{papers.filter((paper) => paper.paperId !== paperBId).map((paper) => <option key={paper.paperId} value={paper.paperId}>{paper.title}</option>)}</select></label>
        <label className="text-sm">Paper B<select value={paperBId} onChange={(event) => setPaperBId(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">{papers.filter((paper) => paper.paperId !== paperAId).map((paper) => <option key={paper.paperId} value={paper.paperId}>{paper.title}</option>)}</select></label>
      </div>
      <label className="mt-3 block text-sm">Literal asset/caption term<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Shared source term" className="mt-1 block w-full rounded border border-neutral-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900" /></label>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Cross-paper activity type">
        {([
          ["paper-vs-paper", "Paper vs Paper"], ["concept-quest", "Cross-paper Concept Quest"], ["timeline", "Timeline Challenge"], ["evolution", "Evolution Challenge"],
        ] as Array<[CrossMode, string]>).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`min-h-9 rounded px-3 text-sm focus-visible:outline-2 focus-visible:outline-sky-600 ${mode === id ? "bg-sky-700 text-white" : "border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"}`}>{label}</button>)}
      </nav>

      <div className="mt-5">
        {mode === "paper-vs-paper" ? <CrossPaperQuest provider={runtime.crossPaper} paperAId={paperAId} paperBId={paperBId} query={query} resolver={runtime.evidence} onNavigateEvidence={navigate} onPinEvidence={pin} /> : selectedChallenge ? <ChallengeRendererShell challenge={selectedChallenge} resolver={runtime.evidence} onNavigateEvidence={navigate} onPinEvidence={pin} /> : <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">This activity is unavailable because the required source relationship could not be verified.</p>}
      </div>

      <section className="mt-6 rounded border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900" aria-labelledby="learning-overlays-heading">
        <h3 id="learning-overlays-heading" className="font-semibold">Learning context from both papers</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{[paperAId, paperBId].map((paperId) => {
          const paper = runtime.crossPaper.getPaper(paperId);
          const concepts = runtime.learning.getConcepts(paperId);
          const regions = runtime.learning.getDifficultyRegions(paperId);
          return <article key={paperId} className="rounded border border-neutral-200 p-3 dark:border-neutral-800"><h4 className="text-sm font-medium">{paper?.title}</h4><p className="mt-1 text-xs opacity-60">{concepts.length} explicit concepts · {regions.length} relative-difficulty regions</p><p className="mt-2 line-clamp-2 text-xs">{concepts.map((item) => item.label).join(" · ") || "No explicit definitions detected."}</p></article>;
        })}</div>
      </section>
      <p aria-live="polite" className="mt-3 text-sm text-sky-700 dark:text-sky-300">{pinStatus}</p>
    </section>
  );
}
