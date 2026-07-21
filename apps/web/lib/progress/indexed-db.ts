import type { LearningProgress, ProgressRepository } from "./types";

const DATABASE_NAME = "marginalia-learning-progress";
const DATABASE_VERSION = 1;
const STORE = "progress";

interface DatabaseFactory { open(name: string, version?: number): IDBOpenDBRequest }

export class IndexedDbProgressRepository implements ProgressRepository {
  private databasePromise?: Promise<IDBDatabase>;
  constructor(private readonly options: { databaseName?: string; factory?: DatabaseFactory } = {}) {}

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const factory = this.options.factory ?? globalThis.indexedDB;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(this.options.databaseName ?? DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "paperId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open learning progress"));
      request.onblocked = () => reject(new Error("Learning progress upgrade was blocked"));
    });
    return this.databasePromise;
  }

  private async request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await this.database();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      let value: T;
      request.onsuccess = () => { value = request.result; };
      request.onerror = () => reject(request.error ?? new Error("Learning progress request failed"));
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error ?? new Error("Learning progress transaction failed"));
    });
  }

  async getProgress(paperId: string): Promise<LearningProgress | null> {
    return (await this.request<LearningProgress | undefined>("readonly", (store) => store.get(paperId))) ?? null;
  }

  async saveProgress(progress: LearningProgress): Promise<LearningProgress> {
    const stored = structuredClone(progress);
    await this.request<IDBValidKey>("readwrite", (store) => store.put(stored));
    return stored;
  }
}
