import { buildDifficultyRegions } from "./difficulty";
import { buildLearningObjects } from "./objects";
import { buildConceptThread } from "./threads";
import type { PaperLearningIndex } from "./paper-index";
import type { ConceptThread, LearningRegion } from "./types";
import type { ConceptRef } from "../research-context/types";

/** Shared Dev A contract. Consumers receive source-linked data, never a game component. */
export interface LearningContextProvider {
  getConcepts(paperId: string): ConceptRef[];
  getConceptThread(paperId: string, conceptId: string): ConceptThread | null;
  getDifficultyRegions(paperId: string): LearningRegion[];
}

interface PaperLearningData {
  index: PaperLearningIndex;
  concepts: ConceptRef[];
  regions: LearningRegion[];
}

export class IndexedLearningContextProvider implements LearningContextProvider {
  private readonly papers = new Map<string, PaperLearningData>();

  constructor(indices: readonly PaperLearningIndex[]) {
    for (const index of indices) {
      const objects = buildLearningObjects(index);
      const concepts = objects
        .filter((object) => object.kind === "concept")
        .map((object) => ({ conceptId: object.id, paperId: object.paperId, label: object.label }));
      this.papers.set(index.paperId, { index, concepts, regions: buildDifficultyRegions(index, objects) });
    }
  }

  getConcepts(paperId: string): ConceptRef[] {
    return [...(this.papers.get(paperId)?.concepts ?? [])];
  }

  getConceptThread(paperId: string, conceptId: string): ConceptThread | null {
    const data = this.papers.get(paperId);
    const concept = data?.concepts.find((candidate) => candidate.conceptId === conceptId);
    if (!data || !concept) return null;
    return buildConceptThread({
      paperId,
      concept: concept.label,
      pages: data.index.pages,
      sections: data.index.manifest.sections,
      assets: data.index.manifest.assets,
    });
  }

  getDifficultyRegions(paperId: string): LearningRegion[] {
    return [...(this.papers.get(paperId)?.regions ?? [])];
  }
}
