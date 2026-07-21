import { assetEvidence, evidenceKey, passageEvidence } from "../evidence/source";
import type { Asset } from "../manifest";
import type { PassageRef } from "../research-context/types";
import type { PaperLearningIndex } from "./paper-index";
import type {
  ClaimObject,
  ConceptObject,
  DefinitionObject,
  EvidenceObject,
  ExperimentObject,
  FigureObject,
  LearningObject,
  TableObject,
} from "./types";

const DEFINITION = /\b(?:we\s+)?(?:define|call|refer to)\s+(?:the\s+)?["“]?([\p{L}][\p{L}\p{N} _-]{1,80}?)["”]?\s+(?:as|to be)\b/iu;
const CLAIM = /\b(?:we|results?|experiments?)\s+(?:show|find|demonstrate|indicate)\b/i;

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function sourceForPassage(passage: PassageRef) {
  return passageEvidence(passage.paperId, passage.page, passage.text, {
    ...(passage.bbox ? { bbox: passage.bbox } : {}),
    ...(passage.sectionId ? { sectionId: passage.sectionId } : {}),
  });
}

function sourceAssetRef(paperId: string, asset: Asset) {
  return {
    paperId,
    assetId: asset.asset_id,
    kind: asset.kind,
    label: asset.label,
    page: asset.page,
    bbox: asset.bbox,
    caption: asset.caption,
  };
}

function figureObject(index: PaperLearningIndex, asset: Asset): FigureObject | TableObject | null {
  if (asset.kind !== "figure" && asset.kind !== "table") return null;
  const evidence = assetEvidence(index.paperId, asset);
  const base = {
    id: `${index.paperId}:${asset.kind}:${asset.asset_id}`,
    paperId: index.paperId,
    label: asset.label,
    evidence: [evidence],
    confidence: 1,
    asset: sourceAssetRef(index.paperId, asset),
  };
  return asset.kind === "figure" ? { ...base, kind: "figure" } : { ...base, kind: "table" };
}

/**
 * Conservative, deterministic learning objects. Every label comes from a literal source
 * phrase or extracted asset; ambiguous noun phrases are intentionally ignored.
 */
export function buildLearningObjects(index: PaperLearningIndex): LearningObject[] {
  const objects: LearningObject[] = [];
  const definitions = new Map<string, { label: string; passage: PassageRef }>();

  for (const passage of index.passages) {
    const evidence = sourceForPassage(passage);
    const evidenceObject: EvidenceObject = {
      id: `${passage.id}:evidence`, kind: "evidence", paperId: index.paperId,
      label: passage.text, evidence: [evidence], confidence: 1,
    };
    objects.push(evidenceObject);

    const definition = passage.text.match(DEFINITION)?.[1]?.replace(/\s+/g, " ").trim();
    const key = definition ? slug(definition) : "";
    if (definition && key && !definitions.has(key)) definitions.set(key, { label: definition, passage });

    if (CLAIM.test(passage.text)) {
      const claim: ClaimObject = {
        id: `${passage.id}:claim`, kind: "claim", paperId: index.paperId,
        label: passage.text, claimText: passage.text, evidence: [evidence], confidence: 1,
        supportingEvidenceIds: [evidenceKey(evidence)],
      };
      objects.push(claim);
    }
  }

  for (const [key, definition] of definitions) {
    const evidence = sourceForPassage(definition.passage);
    const concept: ConceptObject = {
      id: `concept-${key}`, kind: "concept", paperId: index.paperId, label: definition.label,
      aliases: [definition.label], prerequisites: [], occurrences: [definition.passage],
      evidence: [evidence], confidence: 1,
    };
    const definitionObject: DefinitionObject = {
      id: `definition-${key}`, kind: "definition", paperId: index.paperId, label: definition.label,
      definitionText: definition.passage.text, evidence: [evidence], confidence: 1,
    };
    objects.push(concept, definitionObject);
  }

  for (const asset of index.manifest.assets) {
    const object = figureObject(index, asset);
    if (object) objects.push(object);
  }

  const methodPassage = index.passages.find((passage) => /\bmethod|approach|model\b/i.test(passage.text));
  const resultPassage = index.passages.find((passage) => /\bresults?|experiments?|evaluation\b/i.test(passage.text));
  if (methodPassage && resultPassage) {
    const experiment: ExperimentObject = {
      id: `${index.paperId}:experiment-0`, kind: "experiment", paperId: index.paperId,
      label: "Source-described experiment", evidence: [sourceForPassage(methodPassage), sourceForPassage(resultPassage)],
      confidence: 1, methodEvidence: [sourceForPassage(methodPassage)], resultEvidence: [sourceForPassage(resultPassage)],
    };
    objects.push(experiment);
  }
  return objects;
}
