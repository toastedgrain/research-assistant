"use client";

import { ChevronDown, ChevronUp, LocateFixed, Pin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { lifecycleAfterScore, scoreChallenge } from "../../lib/challenges/challenge";
import type {
  ChallengeEvidence,
  ChallengeLifecycle,
  ChallengeReturnRecord,
  ChallengeSpec,
  LearnerResponse,
} from "../../lib/challenges/contracts";
import { evaluateEvidenceHunt } from "../../lib/challenges/evidence-hunt";
import { validateChallenge } from "../../lib/challenges/validator";
import { blobUrl } from "../../lib/api";
import { isSourceEvidence } from "../../lib/evidence/source";
import type { EvidenceResolver } from "../../lib/evidence/resource";
import { passageForSelection, type PaperLearningIndex } from "../../lib/learning/paper-index";
import type { SelectionContext } from "../../lib/research-context/types";
import EvidenceHuntRenderer from "./EvidenceHuntRenderer";

interface EvidenceHuntContext {
  index: PaperLearningIndex;
  selection?: SelectionContext;
}

interface Props {
  challenge: ChallengeSpec;
  resolver?: EvidenceResolver;
  evidenceHuntContext?: EvidenceHuntContext;
  position?: number;
  initialReturnRecord?: ChallengeReturnRecord;
  onNavigateEvidence: (evidence: ChallengeEvidence) => void;
  onPinEvidence?: (evidence: ChallengeEvidence) => void;
  onFocusPaper?: () => void;
  onChallengeStateChange?: (record: ChallengeReturnRecord) => void;
}

function initialResponse(challenge: ChallengeSpec, record?: ChallengeReturnRecord): LearnerResponse {
  if (record?.challengeId === challenge.id) return record.response;
  if (challenge.payload.kind === "concept-match") return { kind: "pairs", pairs: {} };
  if (challenge.payload.kind === "paper-check") return { kind: "paper-check", answers: {} };
  if (
    challenge.payload.kind === "ordering" ||
    challenge.payload.kind === "figure-build" ||
    challenge.payload.kind === "timeline" ||
    challenge.payload.kind === "evolution" ||
    challenge.payload.kind === "prerequisite" ||
    challenge.payload.kind === "thread-expedition"
  ) {
    const itemIds = challenge.payload.items.map((item) => item.id);
    return { kind: "order", itemIds: itemIds.length > 1 ? [itemIds.at(-1) as string, ...itemIds.slice(0, -1)] : itemIds };
  }
  if (challenge.payload.kind === "evidence-hunt") return { kind: "evidence-hunt" };
  return { kind: "choice", choiceIds: [] };
}

function choiceLabel(items: readonly { id: string; label: string }[], id: string): string {
  return items.find((item) => item.id === id)?.label ?? id;
}

function ready(response: LearnerResponse, challenge: ChallengeSpec): boolean {
  if (response.kind === "choice") return response.choiceIds.length > 0;
  if (response.kind === "pairs" && challenge.payload.kind === "concept-match") {
    return Object.keys(response.pairs).length === challenge.payload.concepts.length;
  }
  if (response.kind === "paper-check" && challenge.payload.kind === "paper-check") {
    return Object.keys(response.answers).length === challenge.payload.questions.length;
  }
  if (
    response.kind === "order" &&
    (challenge.payload.kind === "ordering" || challenge.payload.kind === "figure-build" || challenge.payload.kind === "timeline" || challenge.payload.kind === "evolution" || challenge.payload.kind === "prerequisite" || challenge.payload.kind === "thread-expedition")
  ) {
    return response.itemIds.length === challenge.payload.items.length;
  }
  return false;
}

function sourceLabel(evidence: ChallengeEvidence, resolver?: EvidenceResolver): string {
  const resolved = resolver?.resolve(evidence);
  const page = isSourceEvidence(evidence.source) ? `p. ${evidence.source.page + 1}` : "paper metadata";
  if (resolved?.status === "resolved") {
    return [resolved.label, page, resolved.section?.title].filter(Boolean).join(" / ");
  }
  return `${evidence.source.kind === "metadata" ? evidence.source.field : evidence.source.kind} / ${page}`;
}

function evidenceExcerpt(evidence: ChallengeEvidence): string {
  return isSourceEvidence(evidence.source) ? evidence.source.text ?? evidence.reason : evidence.source.value;
}

/**
 * Orchestrates validated challenge lifecycle and evidence navigation. Individual research
 * interactions own their controls; this shell only supplies shared instructions/results.
 */
export default function ChallengeRendererShell({
  challenge,
  resolver,
  evidenceHuntContext,
  position,
  initialReturnRecord,
  onNavigateEvidence,
  onPinEvidence,
  onFocusPaper,
  onChallengeStateChange,
}: Props) {
  const validation = useMemo(() => validateChallenge(challenge, resolver), [challenge, resolver]);
  const [response, setResponse] = useState<LearnerResponse>(() => initialResponse(challenge, initialReturnRecord));
  const [lifecycle, setLifecycle] = useState<ChallengeLifecycle>(
    initialReturnRecord?.challengeId === challenge.id ? initialReturnRecord.lifecycle : "active",
  );
  const [genericResult, setGenericResult] = useState<ReturnType<typeof scoreChallenge>>(null);
  const [huntEvaluation, setHuntEvaluation] = useState<ReturnType<typeof evaluateEvidenceHunt> | null>(null);
  const [pendingConcept, setPendingConcept] = useState<string | null>(null);
  const [predictionRevealed, setPredictionRevealed] = useState(false);

  useEffect(() => {
    setResponse(initialResponse(challenge));
    setLifecycle("active");
    setGenericResult(null);
    setHuntEvaluation(null);
    setPendingConcept(null);
    setPredictionRevealed(false);
  }, [challenge]);

  useEffect(() => {
    onChallengeStateChange?.({
      challengeId: challenge.id,
      lifecycle,
      response,
      ...(position === undefined ? {} : { position }),
      focusTargetId: `challenge-${challenge.id}`,
    });
  }, [challenge.id, lifecycle, onChallengeStateChange, position, response]);

  // A scored spec without resolved, relationship-level source evidence never renders.
  if (!validation.valid) return null;

  const choicePayload =
    challenge.payload.kind === "multiple-choice" ||
    challenge.payload.kind === "figure-detective" ||
    challenge.payload.kind === "prediction" ||
    challenge.payload.kind === "claim-evidence" ||
    challenge.payload.kind === "paper-vs-paper"
      ? challenge.payload
      : null;
  const conceptMatch = challenge.payload.kind === "concept-match" ? challenge.payload : null;
  const ordering =
    challenge.payload.kind === "ordering" ||
    challenge.payload.kind === "figure-build" ||
    challenge.payload.kind === "timeline" ||
    challenge.payload.kind === "evolution" ||
    challenge.payload.kind === "prerequisite" ||
    challenge.payload.kind === "thread-expedition"
      ? challenge.payload
      : null;
  const prediction = challenge.payload.kind === "prediction" ? challenge.payload : null;
  const detective = challenge.payload.kind === "figure-detective" ? challenge.payload : null;
  const paperCheck = challenge.payload.kind === "paper-check" ? challenge.payload : null;
  const evidenceHunt = challenge.type === "evidence-hunt" && challenge.payload.kind === "evidence-hunt"
    ? challenge
    : null;
  const selectedPassage = evidenceHuntContext?.selection
    ? passageForSelection(evidenceHuntContext.index, evidenceHuntContext.selection)
    : undefined;
  const detectiveAsset = detective
    ? challenge.evidence
      .map((item) => resolver?.resolve(item))
      .find((item) => item?.status === "resolved" && item.asset?.asset_id === detective.assetId)
    : undefined;

  const submitGeneric = () => {
    const result = scoreChallenge(challenge, response);
    if (!result) return;
    setGenericResult(result);
    setLifecycle(lifecycleAfterScore(result));
  };

  const checkEvidenceHunt = () => {
    if (!evidenceHunt || !evidenceHuntContext || !resolver) {
      setHuntEvaluation({ state: "unresolved", message: "This activity cannot verify a source-grounded answer.", points: 0, maxPoints: 0 });
      return;
    }
    setResponse({ kind: "evidence-hunt", ...(selectedPassage ? { selectedPassageId: selectedPassage.id } : {}) });
    const evaluation = evaluateEvidenceHunt(
      evidenceHunt,
      evidenceHuntContext.selection,
      evidenceHuntContext.index,
      resolver,
    );
    setHuntEvaluation(evaluation);
    setLifecycle(evaluation.state === "supported" ? "complete" : "submitted");
  };

  const compareEvidence = () => {
    const target = evidenceHunt?.mode === "scored"
      ? evidenceHunt.answer.acceptedEvidenceIds
        .map((id) => evidenceHunt.evidence.find((item) => item.id === id))
        .find((item): item is ChallengeEvidence => Boolean(item))
      : challenge.evidence[0];
    if (target) onNavigateEvidence(target);
  };

  return (
    <section
      id={`challenge-${challenge.id}`}
      aria-label={`${challenge.type.replaceAll("-", " ")} challenge`}
      tabIndex={-1}
      className="w-full max-w-xl border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
          <span className="font-medium uppercase">{challenge.type.replaceAll("-", " ")}</span>
          <span>{challenge.difficulty}</span>
          <span>{challenge.mode === "scored" ? "Source-grounded" : "Explore (unscored)"}</span>
          {challenge.generation?.generated && <span>Generated proposal</span>}
        </div>
        <h2 className="text-sm font-semibold leading-5">{challenge.prompt}</h2>
      </header>

      <div className="p-4">
        {evidenceHunt && (
          <EvidenceHuntRenderer
            challenge={evidenceHunt}
            lifecycle={lifecycle}
            selectedPassage={selectedPassage}
            evaluation={huntEvaluation}
            onCheck={checkEvidenceHunt}
            onCompareSource={compareEvidence}
            onRevise={() => {
              setHuntEvaluation(null);
              setLifecycle("active");
              onFocusPaper?.();
            }}
          />
        )}

        {!evidenceHunt && choicePayload && response.kind === "choice" && (
          <div className="grid gap-2">
            {detectiveAsset?.status === "resolved" && detectiveAsset.asset?.image_url && (
              <figure className="mb-2 border border-neutral-200 bg-white p-2 dark:border-neutral-800">
                <img src={blobUrl(detectiveAsset.asset.image_url)} alt="Original figure crop with its caption hidden" className="max-h-64 w-full object-contain" />
                <figcaption className="sr-only">Choose the matching original caption from the source-backed options below.</figcaption>
              </figure>
            )}
            {choicePayload.choices.map((choice) => {
              const selected = response.choiceIds.includes(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={lifecycle === "complete"}
                  className={`min-h-10 border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                    selected
                      ? "border-sky-600 bg-sky-50 dark:bg-sky-950"
                      : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  }`}
                  onClick={() =>
                    setResponse({
                      kind: "choice",
                      choiceIds: choicePayload.kind === "multiple-choice" && choicePayload.multiple
                        ? selected
                          ? response.choiceIds.filter((id) => id !== choice.id)
                          : [...response.choiceIds, choice.id]
                        : [choice.id],
                    })
                  }
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}

        {!evidenceHunt && conceptMatch && response.kind === "pairs" && (
          <div className="grid gap-3">
            <p className="text-xs text-neutral-600 dark:text-neutral-300">Choose a term, then connect it to an original definition. This has a full button-based keyboard path.</p>
            <div className="grid gap-2" aria-label="Concepts to match">
              {conceptMatch.concepts.map((concept) => (
                <button
                  key={concept.id}
                  type="button"
                  disabled={lifecycle === "complete"}
                  aria-pressed={pendingConcept === concept.id}
                  className={`min-h-10 border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${pendingConcept === concept.id ? "border-sky-600 bg-sky-50 dark:bg-sky-950" : "border-neutral-300 dark:border-neutral-700"}`}
                  onClick={() => setPendingConcept(concept.id)}
                >
                  <strong>{concept.label}</strong>
                  {response.pairs[concept.id] && <span className="ml-2 text-xs text-neutral-500">matched</span>}
                </button>
              ))}
            </div>
            <div className="grid gap-2" aria-label="Definitions to match">
              {conceptMatch.definitions.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  disabled={!pendingConcept || lifecycle === "complete"}
                  className="min-h-10 border border-neutral-300 px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-45 dark:border-neutral-700"
                  onClick={() => {
                    if (!pendingConcept) return;
                    setResponse({ kind: "pairs", pairs: { ...response.pairs, [pendingConcept]: definition.id } });
                    setPendingConcept(conceptMatch.concepts.find((concept) => !response.pairs[concept.id] && concept.id !== pendingConcept)?.id ?? null);
                  }}
                >
                  {definition.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!evidenceHunt && paperCheck && response.kind === "paper-check" && (
          <div className="grid gap-4">
            {paperCheck.questions.map((question) => (
              <fieldset key={question.id} className="border border-neutral-200 p-3 dark:border-neutral-800">
                <legend className="px-1 text-sm font-medium">{question.category}: {question.prompt}</legend>
                <div className="mt-2 grid gap-2">
                  {question.choices.map((choice) => (
                    <label key={choice.id} className="flex min-h-9 items-center gap-2 border border-neutral-200 px-2 text-sm focus-within:outline-2 focus-within:outline-sky-600 dark:border-neutral-800">
                      <input type="radio" name={`${challenge.id}-${question.id}`} checked={response.answers[question.id] === choice.id} disabled={lifecycle === "complete"} onChange={() => setResponse({ kind: "paper-check", answers: { ...response.answers, [question.id]: choice.id } })} />
                      {choice.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {challenge.payload.kind === "claim-evidence" && (
          <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-300">
            Relationship: <strong>{challenge.payload.relationship}</strong>
            {challenge.payload.relationship !== "supports" && " — this relation is Explore-only unless direct source evidence validates it."}
          </p>
        )}

        {!evidenceHunt && ordering && response.kind === "order" && (
          <div className="grid gap-2">
            {ordering.kind === "figure-build" && <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{ordering.diagramLabel}</p>}
            <ol className="grid gap-2">
            {response.itemIds.map((itemId, index) => (
              <li key={itemId} className="flex min-h-11 items-center border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="mr-3 font-mono text-xs text-neutral-500">{index + 1}</span>
                <span className="min-w-0 flex-1 text-sm">{choiceLabel(ordering.items, itemId)}</span>
                <button
                  type="button"
                  disabled={lifecycle === "complete" || index === 0}
                  aria-label={`Move ${choiceLabel(ordering.items, itemId)} up`}
                  className="flex h-8 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-25"
                  onClick={() => {
                    const next = [...response.itemIds];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    setResponse({ kind: "order", itemIds: next });
                  }}
                ><ChevronUp aria-hidden="true" size={16} /></button>
                <button
                  type="button"
                  disabled={lifecycle === "complete" || index === response.itemIds.length - 1}
                  aria-label={`Move ${choiceLabel(ordering.items, itemId)} down`}
                  className="flex h-8 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-25"
                  onClick={() => {
                    const next = [...response.itemIds];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    setResponse({ kind: "order", itemIds: next });
                  }}
                ><ChevronDown aria-hidden="true" size={16} /></button>
              </li>
            ))}
            </ol>
          </div>
        )}
      </div>

      <footer className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {!evidenceHunt && challenge.mode === "scored" && !genericResult && (
          <button
            type="button"
            disabled={!ready(response, challenge)}
            onClick={submitGeneric}
            className="min-h-9 bg-sky-700 px-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40"
          >
            Check answer
          </button>
        )}
        {!evidenceHunt && challenge.mode === "explore" && (
          <div className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <p>Explore this source relationship; it does not make a scored correctness claim.</p>
            {prediction && (
              <>
                <button
                  type="button"
                  onClick={() => setPredictionRevealed(true)}
                  className="min-h-9 w-fit border border-sky-700 px-3 text-sm text-sky-800 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-sky-300 dark:hover:bg-sky-950"
                >
                  Reveal the paper’s result
                </button>
                {predictionRevealed && <p aria-live="polite">The reported result is available through the source evidence below. Your prediction is not scored as universally right or wrong.</p>}
              </>
            )}
          </div>
        )}
        {genericResult && (
          <div className="mt-2">
            <p aria-live="polite" className="text-sm font-medium">
              {genericResult.correct
                ? "This response matches the source-grounded relationship."
                : "This response does not match the source-grounded relationship. Review the evidence and revise."}
            </p>
            {genericResult.categoryResults && (
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {Object.entries(genericResult.categoryResults).map(([category, correct]) => <li key={category}>{category}: {correct ? "correct" : "revise"}</li>)}
              </ul>
            )}
            {!genericResult.correct && (
              <button type="button" onClick={() => { setGenericResult(null); setLifecycle("active"); }} className="mt-3 min-h-9 border border-sky-700 px-3 text-sm text-sky-800 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300">
                Retry
              </button>
            )}
          </div>
        )}
        <div className="mt-3 grid gap-1">
          {challenge.evidence.map((evidence) => {
            const resolved = resolver?.resolve(evidence);
            return (
              <button
                key={evidence.id}
                type="button"
                onClick={() => onNavigateEvidence(evidence)}
                className="flex min-h-9 items-start gap-2 border border-neutral-200 px-2 py-2 text-left text-xs hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <LocateFixed aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                <span>
                  <strong className="block">Show evidence · {sourceLabel(evidence, resolver)}</strong>
                  <span className="line-clamp-2">{resolved?.status === "resolved" ? resolved.excerpt : evidenceExcerpt(evidence)}</span>
                  <span className="block text-neutral-500">{evidence.reason}</span>
                </span>
              </button>
            );
          })}
        </div>
        {onPinEvidence && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Pin verified challenge evidence">
            {challenge.evidence.filter((item) => isSourceEvidence(item.source) && resolver?.resolve(item).status === "resolved").map((item) => (
              <button key={`pin-${item.id}`} type="button" onClick={() => onPinEvidence(item)} className="flex min-h-8 items-center gap-1 border border-neutral-300 px-2 text-xs hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:border-neutral-700 dark:hover:bg-neutral-900">
                <Pin aria-hidden="true" size={13} /> Pin {sourceLabel(item, resolver)}
              </button>
            ))}
          </div>
        )}
      </footer>
    </section>
  );
}
