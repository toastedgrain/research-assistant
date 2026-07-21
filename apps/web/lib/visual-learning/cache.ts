import { VISUAL_LEARNING_SCHEMA_VERSION, type VisualChallengeGenerationResponse, type VisualGenerationRequest, type VisualLearningGenerationResponse } from "./contracts";

const DATABASE_NAME = "marginalia-generated-learning";
const DATABASE_VERSION = 2;
const STORE = "artifacts";
const EVIDENCE_STORE = "evidence-artifacts";

export type GeneratedArtifactKind = "learning" | "challenge";
export type GeneratedArtifactResponse = VisualLearningGenerationResponse | VisualChallengeGenerationResponse;

export interface GeneratedVisualArtifact {
  key: string;
  kind: GeneratedArtifactKind;
  paperId: string;
  model: string;
  schemaVersion: typeof VISUAL_LEARNING_SCHEMA_VERSION;
  createdAt: number;
  response: GeneratedArtifactResponse;
}

export interface GeneratedEvidenceArtifact<T = unknown> {
  key: string;
  kind: "evidence-graph" | "evidence-packet" | "investigation" | "tension";
  paperIds: string[];
  model: string;
  schemaVersion: 1;
  createdAt: number;
  response: T;
}

interface DatabaseFactory { open(name: string, version?: number): IDBOpenDBRequest }

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function generatedVisualCacheKey(
  request: VisualGenerationRequest,
  kind: GeneratedArtifactKind,
  model: string,
): string {
  return `generated-${stableHash(JSON.stringify([
    request.paper.paperId,
    [...request.sourceEvidence.map((item) => item.id)].sort(),
    request.intent,
    request.learningMode,
    request.difficulty,
    request.learningObjective,
    kind,
    model,
    VISUAL_LEARNING_SCHEMA_VERSION,
  ]))}`;
}

export class IndexedDbGeneratedVisualRepository {
  private databasePromise?: Promise<IDBDatabase>;
  constructor(private readonly options: { databaseName?: string; factory?: DatabaseFactory } = {}) {}

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const factory = this.options.factory ?? globalThis.indexedDB;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.options.databaseName ?? DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" });
        if (!request.result.objectStoreNames.contains(EVIDENCE_STORE)) request.result.createObjectStore(EVIDENCE_STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open generated learning cache"));
      request.onblocked = () => reject(new Error("Generated learning cache upgrade was blocked"));
    });
    this.databasePromise = pending.catch((error) => {
      this.databasePromise = undefined;
      throw error;
    });
    return this.databasePromise;
  }

  private async request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T> {
    const database = await this.database();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      let value: T;
      request.onsuccess = () => { value = request.result; };
      request.onerror = () => reject(request.error ?? new Error("Generated learning cache request failed"));
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error ?? new Error("Generated learning cache transaction failed"));
    });
  }

  async get(key: string): Promise<GeneratedVisualArtifact | null> {
    return (await this.request<GeneratedVisualArtifact | undefined>("readonly", (store) => store.get(key))) ?? null;
  }

  async put(artifact: GeneratedVisualArtifact): Promise<GeneratedVisualArtifact> {
    const stored = structuredClone(artifact);
    await this.request<IDBValidKey>("readwrite", (store) => store.put(stored));
    return stored;
  }

  async getEvidence<T>(key: string): Promise<GeneratedEvidenceArtifact<T> | null> {
    return (await this.request<GeneratedEvidenceArtifact<T> | undefined>("readonly", (store) => store.get(key), EVIDENCE_STORE)) ?? null;
  }

  async putEvidence<T>(artifact: GeneratedEvidenceArtifact<T>): Promise<GeneratedEvidenceArtifact<T>> {
    const stored = structuredClone(artifact);
    await this.request<IDBValidKey>("readwrite", (store) => store.put(stored), EVIDENCE_STORE);
    return stored;
  }
}
