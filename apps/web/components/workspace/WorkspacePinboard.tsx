"use client";

import { useEffect, useMemo, useState } from "react";
import { loadManifest } from "../../lib/api";
import { sourceEvidenceHref } from "../../lib/evidence/navigation";
import { validateSourceEvidence } from "../../lib/evidence/resource";
import type { Manifest } from "../../lib/manifest";
import { addBoardNode, connectBoardNodes, moveBoardNode, removeBoardNode } from "../../lib/workspace/board";
import { evidenceLabel } from "../../lib/workspace/evidence";
import { IndexedDbWorkspaceRepository } from "../../lib/workspace/indexed-db";
import type { ResearchCollection } from "../../lib/workspace/types";

export default function WorkspacePinboard({ collectionId }: { collectionId: string }) {
  const repository = useMemo(() => new IndexedDbWorkspaceRepository(), []);
  const [collection, setCollection] = useState<ResearchCollection | null>(null);
  const [manifests, setManifests] = useState<Map<string, Manifest>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  useEffect(() => {
    let cancelled = false;
    repository.getCollection(collectionId).then(async (result) => {
      if (cancelled) return;
      setCollection(result);
      if (!result) return;
      const ids = new Set([
        ...result.papers.map(({ paperId: id }) => id),
        ...result.boardNodes.flatMap((node) => node.source ? [node.source.paperId] : []),
      ]);
      const loaded = await Promise.allSettled([...ids].map(async (id) => [id, await loadManifest(id)] as const));
      if (!cancelled) setManifests(new Map(loaded.flatMap((item) => item.status === "fulfilled" ? [item.value] : [])));
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; };
  }, [collectionId, repository]);

  const save = async (updated: ResearchCollection) => {
    try {
      setCollection(await repository.saveCollection(updated));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (!collection) {
    return <main className="p-8">{error ? <p role="alert" className="text-red-700">{error}</p> : <p className="opacity-60">Loading pinboard…</p>}</main>;
  }

  const nodeById = new Map(collection.boardNodes.map((node) => [node.id, node]));

  return (
    <main className="min-h-screen bg-neutral-100 p-4 dark:bg-neutral-950 dark:text-neutral-100 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-5 dark:border-neutral-800">
          <div>
            <a href="/workspace" className="text-sm text-sky-700 hover:underline dark:text-sky-300">← Collections</a>
            <h1 className="mt-2 text-2xl font-semibold">{collection.name} · Pinboard</h1>
            <p className="mt-1 text-sm opacity-60">Source cards remain verified; note cards are explicitly user-authored. Every line is user-created.</p>
          </div>
          <a href={`/workspace/collections/${collection.id}/compare`} className="rounded border px-3 py-2 text-sm hover:bg-white dark:hover:bg-neutral-900">Compare evidence</a>
        </header>
        {error ? <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}

        <section className="mt-6 grid gap-3 rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-[1fr_auto]" aria-label="Add user note">
          <div>
            <label htmlFor="pinboard-note" className="text-xs font-semibold uppercase tracking-wide opacity-60">User note</label>
            <input id="pinboard-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write your own note" className="mt-1 w-full rounded border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950" />
            <p className="mt-1 text-xs opacity-60">Notes are user-authored. Verified evidence is pinned from a source surface.</p>
          </div>
          <button type="button" disabled={!note.trim()} onClick={() => {
            const index = collection.boardNodes.length;
            void save(addBoardNode(collection, { id: crypto.randomUUID(), note: note.trim(), x: 30 + (index % 4) * 210, y: 35 + Math.floor(index / 4) * 150 }));
            setNote("");
          }} className="self-end rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-40">Add user note</button>
        </section>

        {collection.boardNodes.length >= 2 ? (
          <section className="mt-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Connect cards">
            <span className="font-medium">Connect</span>
            <select value={fromId} onChange={(event) => setFromId(event.target.value)} aria-label="First card" className="rounded border px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"><option value="">First card</option>{collection.boardNodes.map((node) => <option key={node.id} value={node.id}>{node.note || node.id}</option>)}</select>
            <span>to</span>
            <select value={toId} onChange={(event) => setToId(event.target.value)} aria-label="Second card" className="rounded border px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"><option value="">Second card</option>{collection.boardNodes.map((node) => <option key={node.id} value={node.id}>{node.note || node.id}</option>)}</select>
            <button type="button" disabled={!fromId || !toId || fromId === toId} onClick={() => void save(connectBoardNodes(collection, fromId, toId))} className="rounded border px-3 py-1 disabled:opacity-40">Create user connection</button>
          </section>
        ) : null}

        <div className="mt-6 overflow-x-auto">
        <section className="relative h-[38rem] min-w-[56rem] overflow-hidden rounded-lg border border-neutral-300 bg-[linear-gradient(to_right,rgba(14,165,233,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(14,165,233,.08)_1px,transparent_1px)] bg-[size:24px_24px] dark:border-neutral-800" aria-label="Research pinboard canvas">
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {collection.boardEdges.map((edge) => {
              const from = nodeById.get(edge.sourceNodeId); const to = nodeById.get(edge.targetNodeId);
              return from && to ? <line key={edge.id} x1={from.x + 85} y1={from.y + 45} x2={to.x + 85} y2={to.y + 45} stroke="currentColor" strokeWidth="2" className="text-violet-500" /> : null;
            })}
          </svg>
          {collection.boardNodes.map((node) => {
            const manifest = node.source ? manifests.get(node.source.paperId) ?? null : null;
            const validation = node.source ? validateSourceEvidence(node.source, manifest) : null;
            const unavailableReason = validation?.status === "unresolved" ? validation.reason : null;
            return (
              <article key={node.id} draggable onDragEnd={(event) => {
                const canvas = event.currentTarget.parentElement?.getBoundingClientRect();
                if (canvas) void save(moveBoardNode(collection, node.id, { x: event.clientX - canvas.left - 85, y: event.clientY - canvas.top - 45 }));
              }} style={{ left: node.x, top: node.y }} className="absolute w-44 cursor-grab rounded-md border border-neutral-300 bg-white p-3 text-sm shadow-md active:cursor-grabbing dark:border-neutral-700 dark:bg-neutral-900">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-55">{node.source ? validation?.status === "resolved" ? "Verified source" : "Unavailable source" : "User note"}</p>
                <p className="mt-1 font-medium">{node.note || "Evidence card"}</p>
                {node.source ? <p className="mt-2 text-xs opacity-65">{evidenceLabel(node.source, manifest)}</p> : null}
                {node.source && validation?.status === "resolved" ? <a href={sourceEvidenceHref(node.source)} className="mt-2 block text-xs text-sky-700 hover:underline dark:text-sky-300">Show exact source →</a> : node.source ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Source unavailable: {unavailableReason ?? "source could not be verified"}</p> : null}
                <div className="mt-3 grid grid-cols-4 gap-1" role="group" aria-label={`Move ${node.note || "evidence card"}`}>
                  <button type="button" aria-label="Move card left" onClick={() => void save(moveBoardNode(collection, node.id, { x: node.x - 24, y: node.y }))} className="rounded border px-1 py-1">←</button>
                  <button type="button" aria-label="Move card up" onClick={() => void save(moveBoardNode(collection, node.id, { x: node.x, y: node.y - 24 }))} className="rounded border px-1 py-1">↑</button>
                  <button type="button" aria-label="Move card down" onClick={() => void save(moveBoardNode(collection, node.id, { x: node.x, y: node.y + 24 }))} className="rounded border px-1 py-1">↓</button>
                  <button type="button" aria-label="Move card right" onClick={() => void save(moveBoardNode(collection, node.id, { x: node.x + 24, y: node.y }))} className="rounded border px-1 py-1">→</button>
                </div>
                <button type="button" onClick={() => void save(removeBoardNode(collection, node.id))} className="mt-3 text-xs text-red-700 hover:underline dark:text-red-300">Remove card</button>
              </article>
            );
          })}
        </section>
        </div>
      </div>
    </main>
  );
}
