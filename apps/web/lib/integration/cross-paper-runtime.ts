import { createEvidenceResolver } from "../evidence/resource";
import type { PaperAnalysis } from "../explore/analysis";
import type { CitationGraphModel } from "../explore/citation-graph";
import { IndexedCrossPaperContextProvider } from "../explore/cross-paper-provider";
import { getPaperLearningIndex } from "../learning/paper-index";
import { IndexedLearningContextProvider } from "../learning/provider";
import type { ResearchCollection } from "../workspace/types";

/** Production composition boundary shared by the collection research UI and tests. */
export function createCrossPaperRuntime(
  analyses: readonly PaperAnalysis[],
  collection: ResearchCollection,
  graph: CitationGraphModel,
) {
  const indices = analyses.map((analysis) => getPaperLearningIndex(
    analysis.manifest,
    analysis.pageItems.map((items, page) => ({
      items,
      mentions: analysis.mentionsByPage[page] ?? [],
      citations: analysis.citationsByPage[page] ?? [],
    })),
  ));
  return {
    indices,
    crossPaper: new IndexedCrossPaperContextProvider(analyses, [collection], graph),
    learning: new IndexedLearningContextProvider(indices),
    evidence: createEvidenceResolver(indices),
  };
}
