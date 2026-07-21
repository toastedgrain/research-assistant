import { canonicalPaperId, type PaperRef, type SourceEvidence } from "../evidence/source";
import type { ResearchCollection } from "./types";

type IdentityOptions = { id?: string; now?: number };

const newId = () => globalThis.crypto.randomUUID();

export function createCollection(
  name: string,
  options: IdentityOptions = {},
): ResearchCollection {
  const now = options.now ?? Date.now();
  return {
    version: 2,
    id: options.id ?? newId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    papers: [],
    pinnedEvidence: [],
    notes: [],
    comparisons: [],
    boardNodes: [],
    boardEdges: [],
    evidenceArtifacts: [],
  };
}

/** Upgrade durable browser records without resetting or splitting the canonical store. */
export function normalizeCollection(value: ResearchCollection | (Omit<ResearchCollection, "version" | "boardEdges" | "evidenceArtifacts"> & { version: 1 | 2; boardEdges?: ResearchCollection["boardEdges"]; evidenceArtifacts?: ResearchCollection["evidenceArtifacts"] })): ResearchCollection {
  const canonicalSource = (source: SourceEvidence): SourceEvidence => ({ ...source, paperId: canonicalPaperId(source.paperId) });
  return {
    ...value,
    version: 2,
    papers: value.papers.map((paper) => ({ ...paper, paperId: canonicalPaperId(paper.paperId) })),
    pinnedEvidence: value.pinnedEvidence.map(canonicalSource),
    notes: value.notes.map((note) => note.source ? { ...note, source: canonicalSource(note.source) } : note),
    comparisons: value.comparisons.map((comparison) => ({ ...comparison, evidence: comparison.evidence.map(canonicalSource) })),
    boardNodes: value.boardNodes.map((node) => node.source ? { ...node, source: canonicalSource(node.source) } : node),
    boardEdges: value.version === 2 ? value.boardEdges ?? [] : [],
    evidenceArtifacts: (value.evidenceArtifacts ?? []).map((artifact) => ({ ...artifact, sourceEvidence: artifact.sourceEvidence.map(canonicalSource) })),
  };
}

export function renameCollection(
  collection: ResearchCollection,
  name: string,
  now = Date.now(),
): ResearchCollection {
  const trimmed = name.trim();
  if (!trimmed || trimmed === collection.name) return collection;
  return { ...collection, name: trimmed, updatedAt: now };
}

export function addPaperToCollection(
  collection: ResearchCollection,
  paper: PaperRef,
  now = Date.now(),
): ResearchCollection {
  if (collection.papers.some(({ paperId }) => paperId === paper.paperId)) return collection;
  return { ...collection, papers: [...collection.papers, paper], updatedAt: now };
}

export function removePaperFromCollection(
  collection: ResearchCollection,
  paperId: string,
  now = Date.now(),
): ResearchCollection {
  if (!collection.papers.some((paper) => paper.paperId === paperId)) return collection;
  return { ...collection, papers: collection.papers.filter((paper) => paper.paperId !== paperId), updatedAt: now };
}

export function addNoteToCollection(
  collection: ResearchCollection,
  text: string,
  source?: SourceEvidence,
  options: IdentityOptions = {},
): ResearchCollection {
  const trimmed = text.trim();
  if (!trimmed) return collection;
  const now = options.now ?? Date.now();
  return {
    ...collection,
    notes: [
      ...collection.notes,
      { id: options.id ?? newId(), text: trimmed, source, createdAt: now },
    ],
    updatedAt: now,
  };
}

export function partitionCollectionPapers(
  collection: ResearchCollection,
  availablePaperIds: ReadonlySet<string>,
): { available: PaperRef[]; missing: PaperRef[] } {
  return collection.papers.reduce(
    (result, paper) => {
      result[availablePaperIds.has(paper.paperId) ? "available" : "missing"].push(paper);
      return result;
    },
    { available: [] as PaperRef[], missing: [] as PaperRef[] },
  );
}
