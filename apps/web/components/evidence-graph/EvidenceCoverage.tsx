"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sourceEvidenceHref } from "../../lib/evidence/navigation";
import { buildEvidenceGraph, boundedGraph } from "../../lib/evidence-graph/evidence-graph";
import { getPaperLearningIndex } from "../../lib/learning/paper-index";
import type { PaperAnalysis } from "../../lib/explore/analysis";
import EvidenceGraphCanvas from "./EvidenceGraphCanvas";

export default function EvidenceCoverage({ analysis }: { analysis: PaperAnalysis }) {
  const router = useRouter();
  const index = useMemo(() => getPaperLearningIndex(analysis.manifest, analysis.pageItems.map((items, page) => ({ items, mentions: analysis.mentionsByPage[page] ?? [], citations: analysis.citationsByPage[page] ?? [] }))), [analysis]);
  const graph = useMemo(() => buildEvidenceGraph(index), [index]);
  const claims = graph.nodes.filter((node) => node.type === "claim");
  const [selectedId, setSelectedId] = useState(claims[0]?.id ?? "");
  const selected = claims.find((claim) => claim.id === selectedId) ?? claims[0];
  const local = selected ? boundedGraph(graph, selected.id, 24) : null;

  if (!selected || !local) return <section className="mx-auto max-w-4xl p-8"><h2 className="text-2xl font-semibold">Evidence coverage</h2><p className="mt-2 text-sm opacity-65">No conservative source claims were located in the currently indexed text. Marginalia renders less rather than guessing.</p></section>;

  return (
    <section className="mx-auto grid max-w-6xl gap-5 p-5 sm:p-8" aria-labelledby="evidence-coverage-heading">
      <header><p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Paper-level evidence architecture</p><h2 id="evidence-coverage-heading" className="mt-1 text-2xl font-semibold">Evidence coverage</h2><p className="mt-2 max-w-3xl text-sm opacity-65">Claims are canonical source passages. Solid links are literal indexed relationships; a missing link means only that no confident direct supporting relationship was located in the currently indexed paper.</p></header>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <nav aria-label="Indexed source claims" className="max-h-[620px] overflow-y-auto rounded-xl border border-neutral-300 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"><p className="px-2 pb-2 text-xs font-semibold uppercase opacity-55">Claims ({claims.length})</p><ul className="grid gap-2">{claims.map((claim) => { const count = graph.edges.filter((edge) => edge.source === claim.id && edge.type === "supports" && edge.provenance === "literal").length; return <li key={claim.id}><button type="button" aria-current={selected.id === claim.id ? "true" : undefined} onClick={() => setSelectedId(claim.id)} className={`w-full rounded-lg border p-3 text-left text-xs leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${selected.id === claim.id ? "border-sky-600 bg-sky-50 dark:bg-sky-950/30" : "border-neutral-200 dark:border-neutral-800"}`}><span className="line-clamp-3">{claim.label}</span><span className="mt-2 block text-[10px] font-semibold uppercase opacity-55">{count ? `${count} direct source link${count === 1 ? "" : "s"}` : "No confident direct link located"}</span></button></li>; })}</ul></nav>
        <EvidenceGraphCanvas graph={local} rootId={selected.id} onShowEvidence={(source) => router.push(sourceEvidenceHref(source))} />
      </div>
    </section>
  );
}
