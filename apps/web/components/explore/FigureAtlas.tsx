"use client";

import { useMemo, useState } from "react";
import { blobUrl } from "../../lib/api";
import { sourceEvidenceHref, sourcePageHref } from "../../lib/evidence/navigation";
import {
  buildAtlasEntries,
  groupByKind,
  groupBySection,
  type AtlasEntry,
} from "../../lib/explore/atlas";
import type { PaperAnalysis } from "../../lib/explore/analysis";
import { IndexedDbWorkspaceRepository } from "../../lib/workspace/indexed-db";
import { pinVerifiedEvidence } from "../../lib/workspace/pinning";

type Grouping = "kind" | "section";

interface Props {
  analysis: PaperAnalysis;
  digest: string;
}

/**
 * Visual skim of a paper through its extracted assets (§B1).
 *
 * Every card is a real manifest asset — nothing here is inferred. An asset whose crop is
 * unusable still appears, because its caption is real content, but it renders as text
 * rather than a broken image.
 */
export default function FigureAtlas({ analysis, digest }: Props) {
  const [grouping, setGrouping] = useState<Grouping>("kind");
  const [pinStatus, setPinStatus] = useState("");
  const repository = useMemo(() => new IndexedDbWorkspaceRepository(), []);

  const entries = useMemo(
    () => buildAtlasEntries(analysis.manifest, analysis.reverseIndex),
    [analysis],
  );
  const groups = useMemo(
    () => (grouping === "kind" ? groupByKind(entries) : groupBySection(entries, analysis.manifest)),
    [entries, grouping, analysis.manifest],
  );

  if (entries.length === 0) {
    return (
      <p className="p-8 text-sm opacity-60">
        No figures or tables were extracted from this paper.
      </p>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide opacity-60">Group by</span>
        {(["kind", "section"] as Grouping[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGrouping(option)}
            aria-pressed={grouping === option}
            className={`rounded px-2.5 py-1 text-sm ${
              grouping === option
                ? "bg-sky-600 text-white"
                : "bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            }`}
          >
            {option === "kind" ? "Type" : "Section"}
          </button>
        ))}
        <span className="ml-auto text-xs opacity-60">
          {entries.length} asset{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold">
            {group.label}
            <span className="ml-2 font-normal opacity-50">{group.entries.length}</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {group.entries.map((entry) => (
              <AtlasCard key={entry.ref.assetId} entry={entry} digest={digest} onPin={async () => {
                const result = await pinVerifiedEvidence(repository, analysis.manifest, entry.evidence);
                setPinStatus(result.status === "pinned" ? `${entry.label} pinned to Workspace.` : result.reason);
              }} />
            ))}
          </div>
        </section>
      ))}
      <p className="sr-only" aria-live="polite">{pinStatus}</p>
    </div>
  );
}

function AtlasCard({ entry, digest, onPin }: { entry: AtlasEntry; digest: string; onPin: () => void }) {
  // A crop can also fail at request time, not just be absent from the manifest.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = entry.cropUrl !== null && !imageFailed;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <a
        href={sourceEvidenceHref(entry.evidence)}
        title={`Open the paper (${entry.label} is on page ${entry.ref.page + 1})`}
        className="block"
      >
        {showImage ? (
          // Never inverted in dark mode: inverting a white-background plot makes it
          // unreadable and inverting a photo destroys it.
          <img
            src={blobUrl(entry.cropUrl as string)}
            alt={entry.caption || entry.label}
            onError={() => setImageFailed(true)}
            className="h-40 w-full bg-white object-contain"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-neutral-100 px-3 text-center text-xs opacity-60 dark:bg-neutral-800">
            No crop available for {entry.label}
          </div>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium">{entry.label}</h3>
          <span className="text-xs opacity-50">p.{entry.ref.page + 1}</span>
        </div>

        <p className="line-clamp-3 text-xs leading-snug opacity-75">{entry.caption}</p>
        <button type="button" onClick={onPin} className="w-fit rounded border border-sky-700 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300 dark:hover:bg-sky-950">Pin verified asset</button>

        {/*
          Reverse links, the same headline feature the reader card exposes (spec §8):
          the pages this asset is discussed on. Absent rather than zero when the paper
          never references it, so we never render a link to nowhere.
        */}
        {entry.mentionPages.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-1 text-xs">
            <span className="opacity-50">referenced from</span>
            {entry.mentionPages.map((page) => (
              <a
                key={page}
                href={sourcePageHref(digest, page)}
                title={`Open the paper (referenced on page ${page + 1})`}
                className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                p.{page + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
