"use client";

import { useEffect, useState } from "react";
import { paperHref } from "../../lib/evidence/navigation";
import { loadPaperAnalysis, type PaperAnalysis } from "../../lib/explore/analysis";
import FigureAtlas from "./FigureAtlas";
import PaperMap from "./PaperMap";
import CitationGraph from "./CitationGraph";
import EvidenceCoverage from "../evidence-graph/EvidenceCoverage";

/**
 * Host for the exploration surfaces (§25).
 *
 * Kept as its own route rather than a panel inside the reader, so Developer B's work
 * lands without touching Reader.tsx (§18). Tabs are added here as each surface is built;
 * a surface that does not exist yet is not listed, rather than shown disabled — the same
 * "never render a dead affordance" rule the reader follows.
 */

export type ExploreTab = "evidence" | "figures" | "paper-map" | "citations" | "research";

const TABS: { key: ExploreTab; label: string }[] = [
  { key: "evidence", label: "Evidence Graph" },
  { key: "figures", label: "Figures" },
  { key: "paper-map", label: "Paper Map" },
  { key: "citations", label: "Citations" },
  { key: "research", label: "Timeline · Lineage · Constellation" },
];

export default function ExploreShell({ digest }: { digest: string }) {
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ExploreTab>("evidence");

  useEffect(() => {
    let cancelled = false;
    loadPaperAnalysis(digest)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [digest]);

  if (error) {
    return <p className="p-8 text-red-600">Could not open this paper: {error}</p>;
  }
  if (!analysis) {
    return <p className="p-8 opacity-60">Reading paper…</p>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center gap-4 border-b border-neutral-300 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <a
          href={paperHref(digest)}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
          title="Back to the paper"
        >
          ← Read
        </a>
        <h1 className="truncate text-sm font-medium">
          {analysis.manifest.title || "Untitled paper"}
        </h1>

        <a
          href={`/workspace/${digest}`}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          Workspace
        </a>

        <a
          href={`/reflow/${digest}`}
          className="rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          Reflow
        </a>

        <nav className="ml-auto flex gap-1" aria-label="Exploration views">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`rounded px-3 py-1 text-sm ${
                tab === key
                  ? "bg-sky-600 text-white"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "evidence" && <EvidenceCoverage analysis={analysis} />}
        {tab === "figures" && <FigureAtlas analysis={analysis} digest={digest} />}
        {tab === "paper-map" && <PaperMap analysis={analysis} digest={digest} />}
        {tab === "citations" && <CitationGraph analysis={analysis} digest={digest} />}
        {tab === "research" && (
          <section className="mx-auto max-w-4xl p-8" aria-labelledby="collection-research-heading">
            <h2 id="collection-research-heading" className="text-2xl font-semibold">Collection research views</h2>
            <p className="mt-2 max-w-2xl text-sm opacity-65">Timeline, literal-citation lineage, figure timeline, constellation, author network, method network, and cross-paper learning operate over a bounded persisted collection.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Timeline", "Verified publication chronology plus original figures."],
                ["Lineage", "User-selected papers with literal citation edges only."],
                ["Constellation", "Fixed-size paper nodes connected by observed citations."],
              ].map(([label, description]) => <article key={label} className="rounded border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><h3 className="font-medium">{label}</h3><p className="mt-2 text-sm opacity-60">{description}</p></article>)}
            </div>
            <a href="/workspace" className="mt-6 inline-block rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">Choose a collection in Workspace</a>
          </section>
        )}
      </main>
    </div>
  );
}
