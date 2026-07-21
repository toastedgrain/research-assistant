"use client";

import { useEffect, useMemo, useState } from "react";
import { paperHref, sourceEvidenceHref } from "../../lib/evidence/navigation";
import { validateSourceEvidence } from "../../lib/evidence/resource";
import { loadManifest } from "../../lib/api";
import { paperRefOf, type PaperRef } from "../../lib/evidence/source";
import type { Manifest } from "../../lib/manifest";
import {
  addNoteToCollection,
  addPaperToCollection,
  createCollection,
  removePaperFromCollection,
  renameCollection,
} from "../../lib/workspace/collections";
import { IndexedDbWorkspaceRepository } from "../../lib/workspace/indexed-db";
import type { ResearchCollection } from "../../lib/workspace/types";
import { collectionHasPaper, collectionRows } from "../../lib/workspace/view-model";

interface CollectionCardProps {
  collection: ResearchCollection;
  availablePaperIds: ReadonlySet<string>;
  manifests: ReadonlyMap<string, Manifest>;
  candidate: PaperRef | null;
  onSave(collection: ResearchCollection): Promise<void>;
  onDelete(id: string): Promise<void>;
}

function CollectionCard({
  collection,
  availablePaperIds,
  manifests,
  candidate,
  onSave,
  onDelete,
}: CollectionCardProps) {
  const [name, setName] = useState(collection.name);
  const [note, setNote] = useState("");
  const rows = collectionRows([collection], availablePaperIds)[0].papers;

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(renameCollection(collection, name));
        }}
      >
        <label className="sr-only" htmlFor={`name-${collection.id}`}>
          Collection name
        </label>
        <input
          id={`name-${collection.id}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-2 font-medium dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
          Rename
        </button>
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
          onClick={() => {
            if (window.confirm(`Delete “${collection.name}”? This cannot be undone.`)) {
              void onDelete(collection.id);
            }
          }}
        >
          Delete
        </button>
      </form>

      {candidate && !collectionHasPaper(collection, candidate.paperId) && (
        <button
          type="button"
          className="mt-4 rounded bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-500"
          onClick={() => void onSave(addPaperToCollection(collection, candidate))}
        >
          Add “{candidate.title || "Untitled paper"}”
        </button>
      )}

      <section className="mt-5" aria-labelledby={`papers-${collection.id}`}>
        <h2 id={`papers-${collection.id}`} className="text-xs font-semibold uppercase tracking-wide opacity-60">
          Papers
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm opacity-60">No papers yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {rows.map(({ paper, available }) => (
              <li key={paper.paperId} className="rounded bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
                <div className="font-medium">{paper.title || "Untitled paper"}</div>
                {available ? (
                  <div className="mt-1 flex gap-3">
                    <a className="text-sky-700 hover:underline dark:text-sky-300" href={paperHref(paper.paperId)}>
                      Read
                    </a>
                    <a className="text-sky-700 hover:underline dark:text-sky-300" href={`/explore/${paper.paperId}`}>
                      Explore
                    </a>
                    <button type="button" onClick={() => void onSave(removePaperFromCollection(collection, paper.paperId))} className="text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-300">Remove</button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-3"><p className="text-amber-700 dark:text-amber-300">Unavailable locally</p><button type="button" onClick={() => void onSave(removePaperFromCollection(collection, paper.paperId))} className="text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-300">Remove</button></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {collection.pinnedEvidence.length > 0 && (
        <section className="mt-5" aria-labelledby={`evidence-${collection.id}`}>
          <h2 id={`evidence-${collection.id}`} className="text-xs font-semibold uppercase tracking-wide opacity-60">Verified source evidence</h2>
          <ul className="mt-2 space-y-2">{collection.pinnedEvidence.map((source) => {
            const validation = validateSourceEvidence(source, manifests.get(source.paperId) ?? null);
            return <li key={sourceEvidenceHref(source)} className="rounded bg-neutral-50 p-3 text-sm dark:bg-neutral-950"><span className="font-medium capitalize">{validation.status === "resolved" ? `Verified ${source.kind}` : source.kind}</span><span className="ml-2 text-xs opacity-55">page {source.page + 1}</span>{validation.status === "resolved" ? <a href={sourceEvidenceHref(source)} className="mt-1 block text-sky-700 hover:underline dark:text-sky-300">Open exact source →</a> : <span className="mt-1 block text-amber-700 dark:text-amber-300">Source unavailable: {validation.reason}</span>}</li>;
          })}</ul>
        </section>
      )}

      {collection.evidenceArtifacts.length > 0 && (
        <section className="mt-5" aria-labelledby={`chains-${collection.id}`}>
          <h2 id={`chains-${collection.id}`} className="text-xs font-semibold uppercase tracking-wide opacity-60">Evidence chains and packets</h2>
          <ul className="mt-2 space-y-3">{collection.evidenceArtifacts.map((artifact) => <li key={artifact.id} className={`rounded border p-3 text-sm ${artifact.generated ? "border-dashed border-violet-500" : "border-sky-300 dark:border-sky-800"}`}><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{artifact.label}</span><span className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase">{artifact.type}</span>{artifact.generated && <span className="rounded border border-violet-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">Contains generated relationships</span>}</div><p className="mt-1 text-xs opacity-60">Canonical source references are retained separately from generated interpretation.</p><ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{artifact.sourceEvidence.slice(0, 8).map((source) => { const validation = validateSourceEvidence(source, manifests.get(source.paperId) ?? null); return <li key={`${artifact.id}-${sourceEvidenceHref(source)}`}>{validation.status === "resolved" ? <a href={sourceEvidenceHref(source)} className="text-xs text-sky-700 underline decoration-dotted dark:text-sky-300">{source.kind} p.{source.page + 1}</a> : <span className="text-xs text-amber-700 dark:text-amber-300">Source unavailable</span>}</li>; })}</ul></li>)}</ul>
        </section>
      )}

      <nav className="mt-5 flex gap-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800" aria-label={`${collection.name} workspace tools`}>
        <a href={`/workspace/collections/${collection.id}/board`} className="rounded border px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">Open pinboard</a>
        <a href={`/workspace/collections/${collection.id}/compare`} className="rounded border px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">Compare evidence</a>
        <a href={`/workspace/collections/${collection.id}/research`} className="rounded border px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">Research views</a>
      </nav>

      <section className="mt-5" aria-labelledby={`notes-${collection.id}`}>
        <h2 id={`notes-${collection.id}`} className="text-xs font-semibold uppercase tracking-wide opacity-60">
          Notes
        </h2>
        <form
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const updated = addNoteToCollection(collection, note);
            if (updated !== collection) {
              setNote("");
              void onSave(updated);
            }
          }}
        >
          <label className="sr-only" htmlFor={`note-${collection.id}`}>New note</label>
          <input
            id={`note-${collection.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note"
            className="rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Add user note</button>
        </form>
        <ul className="mt-3 space-y-2">
          {collection.notes.map((item) => (
            <li key={item.id} className="border-l-2 border-sky-500 pl-3 text-sm">
              <p>{item.text}</p>
              <p className="mt-1 text-xs opacity-55">User-authored note</p>
              {item.source && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Legacy unverified pointer retained as note metadata; not an active source link.</p>}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default function WorkspaceShell({ digest }: { digest?: string }) {
  const repository = useMemo(() => new IndexedDbWorkspaceRepository(), []);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [candidate, setCandidate] = useState<PaperRef | null>(null);
  const [availablePaperIds, setAvailablePaperIds] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, Manifest>>(new Map());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await repository.listCollections();
        const ids = new Set(stored.flatMap((collection) => collection.papers.map(({ paperId }) => paperId)));
        if (digest) ids.add(digest);
        const resolved = await Promise.allSettled([...ids].map((paperId) => loadManifest(paperId)));
        if (cancelled) return;
        const available = new Set<string>();
        const loadedManifests = new Map<string, Manifest>();
        for (const result of resolved) {
          if (result.status === "fulfilled") {
            const paperId = paperRefOf(result.value).paperId;
            available.add(paperId);
            loadedManifests.set(paperId, result.value);
          }
        }
        setCollections(stored);
        setAvailablePaperIds(available);
        setManifests(loadedManifests);
        if (digest) {
          const match = resolved[[...ids].indexOf(digest)];
          if (match?.status === "fulfilled") setCandidate(paperRefOf(match.value));
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [digest, repository]);

  const save = async (collection: ResearchCollection) => {
    try {
      await repository.saveCollection(collection);
      setCollections((current) => [collection, ...current.filter(({ id }) => id !== collection.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const remove = async (id: string) => {
    try {
      await repository.deleteCollection(id);
      setCollections((current) => current.filter((collection) => collection.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-4 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center gap-3">
          {digest && <a href={`/explore/${digest}`} className="text-sm text-sky-700 hover:underline dark:text-sky-300">← Explore paper</a>}
          <div>
            <h1 className="text-2xl font-semibold">Research workspace</h1>
            <p className="mt-1 text-sm opacity-65">Collections and evidence stay in this browser.</p>
          </div>
        </header>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            const collection = createCollection(name);
            setName("");
            void save(candidate ? addPaperToCollection(collection, candidate) : collection);
          }}
        >
          <label className="sr-only" htmlFor="new-collection">New collection name</label>
          <input
            id="new-collection"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection name"
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button type="submit" disabled={!name.trim()} className="rounded bg-sky-600 px-4 py-2 text-white disabled:opacity-40">Create</button>
        </form>

        {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {loading ? (
          <p className="mt-8 opacity-60">Loading workspace…</p>
        ) : collections.length === 0 ? (
          <p className="mt-8 rounded border border-dashed border-neutral-400 p-8 text-center opacity-65">Create a collection to organize papers and source-linked notes.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {collectionRows(collections, availablePaperIds).map(({ collection }) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                availablePaperIds={availablePaperIds}
                manifests={manifests}
                candidate={candidate}
                onSave={save}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
