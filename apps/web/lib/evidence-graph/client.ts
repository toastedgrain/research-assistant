import { evidenceKey } from "../evidence/source";
import type { ResearchGraph } from "../explore/graph";
import { IndexedDbGeneratedVisualRepository } from "../visual-learning/cache";
import { loadLearningAiStatus } from "../visual-learning/client";
import { evidenceArtifactCacheKey } from "./cache-key";
import type { EvidencePacket, InvestigatorResult, TensionCandidate } from "./types";

function stableGraphKey(graph: ResearchGraph, model: string): string {
  const ids = graph.nodes.flatMap((node) => (node.evidence ?? (node.source ? [node.source] : [])).map(evidenceKey)).sort();
  let hash = 0x811c9dc5;
  const input = JSON.stringify([graph.nodes.map((node) => node.id).sort(), ids, model, 1]);
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193);
  return `evidence-graph-v1-${(hash >>> 0).toString(16)}`;
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const value = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new Error(value && typeof value === "object" && "error" in value ? value.error : "Local evidence generation failed safely.");
  return value as T;
}

export async function generateEvidenceGraphCandidates(
  graph: ResearchGraph,
  options: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal } = {},
): Promise<ResearchGraph> {
  const status = await loadLearningAiStatus(options.signal);
  if (!status.available || !status.model) return graph;
  const repository = options.repository ?? new IndexedDbGeneratedVisualRepository();
  const key = stableGraphKey(graph, status.model);
  const cached = await repository.getEvidence<{ status: "ready"; graph: ResearchGraph }>(key).catch(() => null);
  if (cached?.response.status === "ready") return cached.response.graph;
  const response = await post<{ status: "ready"; graph: ResearchGraph }>("/api/evidence/graph", graph, options.signal);
  await repository.putEvidence({ key, kind: "evidence-graph", paperIds: [...new Set(graph.nodes.flatMap((node) => (node.evidence ?? []).map((item) => item.paperId)))], model: status.model, schemaVersion: 1, createdAt: Date.now(), response }).catch(() => undefined);
  return response.graph;
}

export async function investigateEvidencePacket(
  question: string,
  packet: EvidencePacket,
  options: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal } = {},
): Promise<InvestigatorResult> {
  const status = await loadLearningAiStatus(options.signal);
  if (!status.available || !status.model) return { status: "insufficient-evidence", reason: "Local AI is unavailable. The verified source packet remains available." };
  const repository = options.repository ?? new IndexedDbGeneratedVisualRepository();
  const key = `${evidenceArtifactCacheKey(`investigation:${question.trim().toLocaleLowerCase()}`, [packet], status.model)}`;
  const cached = await repository.getEvidence<InvestigatorResult>(key).catch(() => null);
  if (cached) return cached.response;
  const response = await post<InvestigatorResult>("/api/evidence/investigate", { question, packet }, options.signal);
  await repository.putEvidence({ key, kind: "investigation", paperIds: [packet.paperId], model: status.model, schemaVersion: 1, createdAt: Date.now(), response }).catch(() => undefined);
  return response;
}

export async function inspectTensions(
  paperA: EvidencePacket,
  paperB: EvidencePacket,
  options: { repository?: IndexedDbGeneratedVisualRepository; signal?: AbortSignal } = {},
): Promise<TensionCandidate[]> {
  const status = await loadLearningAiStatus(options.signal);
  if (!status.available || !status.model) return [];
  const repository = options.repository ?? new IndexedDbGeneratedVisualRepository();
  const key = evidenceArtifactCacheKey("tension", [paperA, paperB], status.model);
  const cached = await repository.getEvidence<{ status: string; candidates?: TensionCandidate[] }>(key).catch(() => null);
  if (cached) return cached.response.candidates ?? [];
  const response = await post<{ status: string; candidates?: TensionCandidate[] }>("/api/evidence/tensions", { paperA, paperB }, options.signal);
  await repository.putEvidence({ key, kind: "tension", paperIds: [paperA.paperId, paperB.paperId], model: status.model, schemaVersion: 1, createdAt: Date.now(), response }).catch(() => undefined);
  return response.candidates ?? [];
}
