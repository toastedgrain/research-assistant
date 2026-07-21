"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  GripVertical,
  Lightbulb,
  LocateFixed,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { ChallengeEvidence } from "../../../lib/challenges/contracts";
import {
  CHAIN_OF_THOUGHT_DEMO_CHALLENGE_ID,
  CHAIN_OF_THOUGHT_DEMO_HINTS,
  CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER,
  CHAIN_OF_THOUGHT_DEMO_STEPS,
  CHAIN_OF_THOUGHT_RESULT_BARS,
  correctChainPrefixLength,
  evaluateChainOfThoughtOrder,
  moveChainStep,
  type ChainOfThoughtDemoEvidence,
  type ChainOfThoughtDemoStep,
} from "../../../lib/visual-learning/demos/chain-of-thought-demo";

type DemoTab = "explore" | "trace" | "build";

interface Props {
  initialTab: DemoTab;
  evidence: ChainOfThoughtDemoEvidence;
  onNavigateEvidence: (evidence: ChallengeEvidence) => void;
  onComplete: (challengeId: string) => void;
}

const toneStyles: Record<ChainOfThoughtDemoStep["tone"], string> = {
  question: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-50",
  input: "border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-50",
  reasoning: "border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-50",
  calculation: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-50",
  answer: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-50",
};

const tabCopy: Record<DemoTab, string> = {
  explore: "Let's watch what changes when the model reasons step by step.",
  trace: "Follow each intermediate step from the question to the answer.",
  build: "Now rebuild the reasoning path yourself.",
};

function EvidenceButton({ evidence, label, onNavigate }: { evidence: ChallengeEvidence | null; label: string; onNavigate: (evidence: ChallengeEvidence) => void }) {
  if (!evidence) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(evidence)}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 motion-reduce:transform-none dark:border-violet-700 dark:bg-neutral-950 dark:text-violet-200"
    >
      <LocateFixed aria-hidden="true" size={16} />
      {label}
    </button>
  );
}

function PlaybackControls({ step, lastStep, playing, onStep, onPlaying }: { step: number; lastStep: number; playing: boolean; onStep: (step: number) => void; onPlaying: (playing: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Animation controls">
      <button type="button" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium disabled:opacity-35 dark:border-neutral-700 dark:bg-neutral-950">
        <ArrowLeft aria-hidden="true" size={15} /> Previous
      </button>
      <button type="button" onClick={() => onPlaying(!playing)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
        {playing ? <Pause aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
        {playing ? "Pause" : step === lastStep ? "Replay" : "Play"}
      </button>
      <button type="button" onClick={() => onStep(Math.min(lastStep, step + 1))} disabled={step === lastStep} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium disabled:opacity-35 dark:border-neutral-700 dark:bg-neutral-950">
        Next <ArrowRight aria-hidden="true" size={15} />
      </button>
      <button type="button" onClick={() => { onPlaying(false); onStep(0); }} aria-label="Restart animation" className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
        <RefreshCw aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

function FlowCard({ visible, eyebrow, title, detail, accent, selected, onSelect, reducedMotion }: {
  visible: boolean;
  eyebrow: string;
  title: string;
  detail?: string;
  accent: "neutral" | "sky" | "violet" | "fuchsia" | "emerald";
  selected: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
}) {
  const styles = {
    neutral: "border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100",
    sky: "border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 text-sky-950 dark:border-sky-700 dark:from-sky-950 dark:to-cyan-950 dark:text-sky-50",
    violet: "border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-950 dark:border-violet-700 dark:from-violet-950 dark:to-indigo-950 dark:text-violet-50",
    fuchsia: "border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-violet-50 text-fuchsia-950 dark:border-fuchsia-700 dark:from-fuchsia-950 dark:to-violet-950 dark:text-fuchsia-50",
    emerald: "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-950 dark:border-emerald-700 dark:from-emerald-950 dark:to-teal-950 dark:text-emerald-50",
  }[accent];
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.button
          type="button"
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: selected ? 1.025 : 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.32, ease: "easeOut" }}
          onClick={onSelect}
          aria-pressed={selected}
          className={`relative z-10 w-full rounded-2xl border p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${styles} ${selected ? "ring-2 ring-violet-500/50" : ""}`}
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">{eyebrow}</span>
          <span className="mt-1 block text-sm font-bold leading-5">{title}</span>
          {detail && <span className="mt-1 block text-xs leading-4 opacity-75">{detail}</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function FlowConnector({ visible, vibrant, reducedMotion }: { visible: boolean; vibrant?: boolean; reducedMotion: boolean }) {
  return (
    <div className="relative mx-auto h-8 w-8" aria-hidden="true">
      {visible && (
        <motion.div
          initial={reducedMotion ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.35 }}
          className={`absolute left-1/2 top-0 h-6 w-0.5 origin-top -translate-x-1/2 ${vibrant ? "bg-gradient-to-b from-violet-500 to-fuchsia-500" : "bg-neutral-400 dark:bg-neutral-600"}`}
        >
          {!reducedMotion && vibrant && <motion.span className="absolute -left-[3px] top-0 h-2 w-2 rounded-full bg-fuchsia-400" animate={{ y: [0, 17, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} />}
        </motion.div>
      )}
      {visible && <ArrowDown className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${vibrant ? "text-fuchsia-500" : "text-neutral-400"}`} size={16} />}
    </div>
  );
}

function MechanismWalkthrough({ evidence, onNavigateEvidence }: { evidence: ChainOfThoughtDemoEvidence; onNavigateEvidence: (evidence: ChallengeEvidence) => void }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [step, setStep] = useState(reducedMotion ? 7 : 0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [detail, setDetail] = useState({ title: "Question", text: "The task the model needs to solve." });

  useEffect(() => {
    if (reducedMotion) {
      setStep(7);
      setPlaying(false);
      return;
    }
    if (!playing) return;
    if (step >= 7) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((current) => Math.min(7, current + 1)), 850);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, step]);

  const setPlayback = (next: boolean) => {
    if (next && step >= 7) setStep(0);
    setPlaying(next && !reducedMotion);
  };
  const select = (title: string, text: string) => setDetail({ title, text });

  return (
    <div className="grid gap-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Mechanism · Figure 1</p>
        <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight md:text-3xl">How chain-of-thought prompting changes the reasoning process</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">Two prompting paths begin with the same kind of question. One goes straight to an answer; the other makes the intermediate reasoning sequence visible.</p>
      </div>

      <PlaybackControls step={step} lastStep={7} playing={playing} onStep={(next) => { setStep(next); setPlaying(false); }} onPlaying={setPlayback} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`rounded-3xl border bg-neutral-100/80 p-4 transition dark:bg-neutral-900/60 ${step >= 7 ? "border-neutral-300 opacity-75 dark:border-neutral-700" : "border-neutral-200 dark:border-neutral-800"}`} aria-labelledby="standard-path-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Direct path</p><h3 id="standard-path-title" className="font-bold">Standard prompting</h3></div>
            <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Input → output</span>
          </div>
          <div className="mx-auto max-w-sm">
            <FlowCard visible={step >= 1} eyebrow="Question" title="Roger has 5 balls, then buys 2 cans of 3." accent="sky" selected={detail.title === "Question"} onSelect={() => select("Question", "The task the model needs to solve.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 2} reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 2} eyebrow="Model" title="Respond directly" detail="No intermediate steps in the output" accent="neutral" selected={detail.title === "Standard model"} onSelect={() => select("Standard model", "Standard prompting supplies input/output examples and produces the answer directly.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 2} reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 2} eyebrow="Direct answer" title="Answer: 11" accent="neutral" selected={detail.title === "Direct answer"} onSelect={() => select("Direct answer", "The answer appears without an intermediate natural-language reasoning sequence.")} reducedMotion={reducedMotion} />
          </div>
        </section>

        <section className={`relative overflow-hidden rounded-3xl border p-4 transition ${step >= 7 ? "border-violet-400 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-sky-50 shadow-[0_18px_60px_-28px_rgba(124,58,237,0.75)] dark:border-violet-600 dark:from-violet-950/80 dark:via-fuchsia-950/50 dark:to-sky-950/60" : "border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20"}`} aria-labelledby="cot-path-title">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-fuchsia-300/25 blur-3xl dark:bg-fuchsia-700/20" />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Reasoning path</p><h3 id="cot-path-title" className="font-bold">Chain-of-thought prompting</h3></div>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900 dark:text-violet-200">Input → thought → output</span>
          </div>
          <div className="relative mx-auto max-w-sm">
            <FlowCard visible={step >= 1} eyebrow="Question" title="Roger has 5 balls, then buys 2 cans of 3." accent="sky" selected={detail.title === "CoT question"} onSelect={() => select("CoT question", "The same task starts the chain-of-thought path.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 3} vibrant reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 3} eyebrow="Model" title="Generate intermediate steps" accent="violet" selected={detail.title === "CoT model"} onSelect={() => select("CoT model", "Few-shot examples are augmented with intermediate reasoning steps.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 4} vibrant reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 4} eyebrow="Reasoning step 1" title="2 cans × 3 = 6 new balls" accent="violet" selected={detail.title === "Reasoning step 1"} onSelect={() => select("Reasoning step 1", "Instead of jumping to the answer, the model generates an intermediate calculation.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 5} vibrant reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 5} eyebrow="Reasoning step 2" title="5 starting balls + 6 new balls = 11" accent="fuchsia" selected={detail.title === "Reasoning step 2"} onSelect={() => select("Reasoning step 2", "The intermediate result is combined with the starting amount.")} reducedMotion={reducedMotion} />
            <FlowConnector visible={step >= 6} vibrant reducedMotion={reducedMotion} />
            <FlowCard visible={step >= 6} eyebrow="Final answer" title="Answer: 11" accent="emerald" selected={detail.title === "Final answer"} onSelect={() => select("Final answer", "The final output is produced after the intermediate reasoning sequence.")} reducedMotion={reducedMotion} />
          </div>
        </section>
      </div>

      <motion.aside key={detail.title} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto grid w-full max-w-2xl gap-3 rounded-2xl border border-violet-200 bg-white/90 p-4 shadow-sm dark:border-violet-800 dark:bg-neutral-950/90" aria-live="polite">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Selected element</p><h3 className="mt-1 font-bold">{detail.title}</h3><p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{detail.text}</p></div>
        <div><EvidenceButton evidence={evidence.mechanism} label="Show Figure 1 evidence" onNavigate={onNavigateEvidence} /></div>
      </motion.aside>
    </div>
  );
}

function ResultComparison({ evidence, onNavigateEvidence }: { evidence: ChainOfThoughtDemoEvidence; onNavigateEvidence: (evidence: ChallengeEvidence) => void }) {
  const reducedMotion = Boolean(useReducedMotion());
  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:p-7" aria-labelledby="why-it-mattered-title">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Reported experiment</p>
          <h2 id="why-it-mattered-title" className="mt-2 text-2xl font-bold tracking-tight">Why it mattered in the paper</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Reported GSM8K solve rate in Figure 2. The highlighted comparison is specific to this experiment; it is not a claim of universal superiority.</p>
          <div className="mt-4"><EvidenceButton evidence={evidence.result} label="Show Figure 2 source" onNavigate={onNavigateEvidence} /></div>
        </div>
        <figure className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <figcaption className="mb-4 flex items-end justify-between gap-3"><span className="text-sm font-bold">GSM8K solve rate</span><span className="text-xs text-neutral-500">percent</span></figcaption>
          <div className="grid gap-4">
            {CHAIN_OF_THOUGHT_RESULT_BARS.map((bar, index) => (
              <div key={bar.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={bar.emphasis ? "font-bold text-violet-800 dark:text-violet-200" : "font-medium"}>{bar.label}</span><span className="font-mono text-sm font-bold">{bar.value}</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <motion.div
                    initial={reducedMotion ? false : { width: 0 }}
                    whileInView={{ width: `${bar.value}%` }}
                    viewport={{ once: true, amount: 0.7 }}
                    transition={{ delay: reducedMotion ? 0 : index * 0.12, duration: reducedMotion ? 0 : 0.65, ease: "easeOut" }}
                    className={`h-full rounded-full ${bar.emphasis ? "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-emerald-400 shadow-[0_0_14px_rgba(168,85,247,0.45)]" : bar.id === "palm-standard" ? "bg-neutral-400 dark:bg-neutral-600" : "bg-sky-500"}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">PaLM 540B + chain-of-thought prompting: 57 reported solve rate</p>
        </figure>
      </div>
    </section>
  );
}

function TraceWalkthrough({ evidence, onNavigateEvidence }: { evidence: ChainOfThoughtDemoEvidence; onNavigateEvidence: (evidence: ChallengeEvidence) => void }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [active, setActive] = useState(0);
  const current = CHAIN_OF_THOUGHT_DEMO_STEPS[active];
  return (
    <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-white via-violet-50/60 to-sky-50 p-5 shadow-sm dark:border-violet-900 dark:from-neutral-950 dark:via-violet-950/30 dark:to-sky-950/30 md:p-7">
      <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Trace the idea</p><h2 className="mt-2 text-2xl font-bold">Question → reasoning → answer</h2><p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Select any source-grounded step or move through the chain in order.</p></div>
      <ol className="mx-auto mt-7 grid max-w-4xl gap-2 md:grid-cols-[repeat(6,minmax(0,1fr))]" aria-label="Chain-of-thought reasoning trace">
        {CHAIN_OF_THOUGHT_DEMO_STEPS.map((step, index) => (
          <li key={step.id} className="relative">
            <motion.button type="button" onClick={() => setActive(index)} aria-current={active === index ? "step" : undefined} animate={{ y: active === index && !reducedMotion ? -5 : 0 }} className={`h-full min-h-24 w-full rounded-2xl border p-3 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${toneStyles[step.tone]} ${active === index ? "ring-2 ring-violet-500/50" : "opacity-80 hover:opacity-100"}`}>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">{index + 1}. {step.eyebrow}</span><span className="mt-2 block text-xs font-bold leading-4">{step.shortLabel}</span>
            </motion.button>
            {index < CHAIN_OF_THOUGHT_DEMO_STEPS.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-violet-400 md:block" size={18} />}
          </li>
        ))}
      </ol>
      <motion.div key={current.id} initial={reducedMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="mx-auto mt-6 max-w-2xl rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/90" aria-live="polite">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-200">{active + 1}</span><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{current.eyebrow}</p><h3 className="mt-1 text-lg font-bold">{current.label}</h3><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{current.description}</p></div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2"><button type="button" onClick={() => setActive((value) => Math.max(0, value - 1))} disabled={active === 0} className="flex h-10 w-10 items-center justify-center rounded-full border bg-white disabled:opacity-30 dark:bg-neutral-950" aria-label="Previous reasoning step"><ArrowLeft aria-hidden="true" size={16} /></button><button type="button" onClick={() => setActive((value) => Math.min(CHAIN_OF_THOUGHT_DEMO_STEPS.length - 1, value + 1))} disabled={active === CHAIN_OF_THOUGHT_DEMO_STEPS.length - 1} className="flex h-10 w-10 items-center justify-center rounded-full border bg-white disabled:opacity-30 dark:bg-neutral-950" aria-label="Next reasoning step"><ArrowRight aria-hidden="true" size={16} /></button></div>
          <EvidenceButton evidence={evidence.mechanism} label="Show Figure 1 evidence" onNavigate={onNavigateEvidence} />
        </div>
      </motion.div>
    </section>
  );
}

function BuildReasoningGame({ evidence, onNavigateEvidence, onComplete }: { evidence: ChainOfThoughtDemoEvidence; onNavigateEvidence: (evidence: ChallengeEvidence) => void; onComplete: (challengeId: string) => void }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [order, setOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"idle" | "incomplete" | "incorrect" | "correct">("idle");
  const [hintIndex, setHintIndex] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const completedOnce = useRef(false);
  const byId = useMemo(() => new Map(CHAIN_OF_THOUGHT_DEMO_STEPS.map((step) => [step.id, step])), []);
  const available = CHAIN_OF_THOUGHT_DEMO_INITIAL_ORDER.filter((id) => !order.includes(id));
  const correctPrefix = correctChainPrefixLength(order);

  const updateOrder = (next: string[]) => {
    setOrder(next);
    setFeedback("idle");
  };

  const placeAt = (id: string, target: number) => updateOrder(moveChainStep(order.includes(id) ? order : [...order, id], id, target));
  const onDrop = (event: DragEvent<HTMLElement>, target: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || draggedId;
    if (id && byId.has(id)) placeAt(id, target);
    setDraggedId(null);
  };
  const startDrag = (event: DragEvent<HTMLElement>, id: string) => {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const submit = () => {
    setAttempt((value) => value + 1);
    if (order.length !== CHAIN_OF_THOUGHT_DEMO_STEPS.length) {
      setFeedback("incomplete");
      return;
    }
    if (!evaluateChainOfThoughtOrder(order)) {
      setFeedback("incorrect");
      return;
    }
    setFeedback("correct");
    if (!completedOnce.current) {
      completedOnce.current = true;
      onComplete(CHAIN_OF_THOUGHT_DEMO_CHALLENGE_ID);
    }
  };
  const reset = () => {
    setOrder([]);
    setFeedback("idle");
    setHintIndex(-1);
    completedOnce.current = false;
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-white via-violet-50/70 to-fuchsia-50 p-4 shadow-[0_24px_80px_-42px_rgba(124,58,237,0.8)] dark:border-violet-900 dark:from-neutral-950 dark:via-violet-950/35 dark:to-fuchsia-950/25 md:p-7" aria-labelledby="build-reasoning-title">
      <div className="grid gap-3 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Visual game · Figure 1</p><h2 id="build-reasoning-title" className="text-2xl font-bold tracking-tight md:text-3xl">Build the reasoning path</h2><p className="mx-auto max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">Reconstruct how chain-of-thought prompting reaches the answer. Drag pieces into the path, or use the keyboard-friendly Add and Move controls.</p></div>

      <div className="mx-auto mt-6 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Reasoning path</p><p className="text-sm font-semibold">{correctPrefix} consecutive {correctPrefix === 1 ? "step" : "steps"} in place</p></div>
          <ol className="flex items-center gap-1.5" aria-label={`${correctPrefix} of ${CHAIN_OF_THOUGHT_DEMO_STEPS.length} consecutive reasoning steps are correct`}>
            {CHAIN_OF_THOUGHT_DEMO_STEPS.map((step, index) => <li key={step.id} className={`h-3 w-3 rounded-full border-2 ${index < correctPrefix ? "border-emerald-600 bg-emerald-500" : index < order.length ? "border-amber-500 bg-amber-100 dark:bg-amber-950" : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"}`}><span className="sr-only">Step {index + 1}: {index < correctPrefix ? "correct position" : index < order.length ? "placed" : "empty"}</span></li>)}
          </ol>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-2xl border border-dashed border-violet-300 bg-white/55 p-4 dark:border-violet-800 dark:bg-neutral-950/45" aria-labelledby="piece-tray-title">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Piece tray</p><h3 id="piece-tray-title" className="font-bold">Reasoning pieces</h3></div><GripVertical aria-hidden="true" className="text-violet-400" size={20} /></div>
            {available.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {available.map((id, index) => {
                  const item = byId.get(id)!;
                  return (
                    <div key={id} draggable onDragStart={(event) => startDrag(event, id)}>
                      <motion.div layout={!reducedMotion} initial={reducedMotion ? false : { opacity: 0, rotate: index % 2 === 0 ? -1.5 : 1.5 }} animate={{ opacity: 1, rotate: index % 2 === 0 ? -1.5 : 1.5 }} className={`group rounded-2xl border p-3 shadow-sm ${toneStyles[item.tone]}`}>
                        <div className="flex items-start gap-2"><GripVertical aria-hidden="true" className="mt-0.5 shrink-0 opacity-40" size={16} /><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-55">{item.eyebrow}</p><p className="mt-1 text-sm font-bold leading-5">{item.shortLabel}</p></div></div>
                        <button type="button" onClick={() => placeAt(id, order.length)} className="mt-3 w-full rounded-lg bg-white/70 px-2 py-2 text-xs font-bold shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:bg-black/20 dark:hover:bg-black/35">Add to path</button>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">All pieces are in the path. Check their order, then submit.</p>}
          </section>

          <section className="rounded-2xl border border-violet-200 bg-white/80 p-4 shadow-sm dark:border-violet-800 dark:bg-neutral-950/70" aria-labelledby="reasoning-path-title">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Build area</p><h3 id="reasoning-path-title" className="font-bold">Your reasoning path</h3></div><button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-300 px-3 text-xs font-semibold dark:border-neutral-700"><RotateCcw aria-hidden="true" size={14} /> Reset</button></div>
            <ol className="mt-4 grid gap-2" aria-label="Ordered reasoning path">
              {CHAIN_OF_THOUGHT_DEMO_STEPS.map((_, index) => {
                const id = order[index];
                const item = id ? byId.get(id) : null;
                const correctHere = Boolean(item && item.id === CHAIN_OF_THOUGHT_DEMO_STEPS[index].id);
                return (
                  <li key={`slot-${index}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, index)} className="relative">
                    {index > 0 && <div className="mx-auto h-3 w-0.5 bg-violet-300 dark:bg-violet-700" aria-hidden="true" />}
                    {item ? (
                      <div draggable onDragStart={(event) => startDrag(event, item.id)}>
                        <motion.div key={`${attempt}-${item.id}-${feedback}`} layout={!reducedMotion} animate={feedback === "incorrect" && !correctHere && !reducedMotion ? { x: [0, -5, 5, -3, 3, 0] } : feedback === "correct" && !reducedMotion ? { scale: [1, 1.015, 1] } : { x: 0, scale: 1 }} className={`rounded-xl border p-3 shadow-sm ${toneStyles[item.tone]} ${feedback === "correct" ? "ring-2 ring-emerald-400/60" : feedback === "incorrect" && !correctHere ? "ring-2 ring-amber-400/60" : ""}`}>
                          <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/75 text-xs font-black shadow-sm dark:bg-black/25">{index + 1}</span><div className="min-w-0 flex-1"><span className="block text-[9px] font-bold uppercase tracking-[0.14em] opacity-55">{item.eyebrow}</span><span className="block text-sm font-bold leading-5">{item.shortLabel}</span></div>{feedback === "correct" && <Check aria-hidden="true" className="text-emerald-600" size={18} />}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2 dark:border-white/10">
                            <button type="button" onClick={() => placeAt(item.id, index - 1)} disabled={index === 0} aria-label={`Move ${item.shortLabel} up`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 disabled:opacity-30 dark:bg-black/20"><ChevronUp aria-hidden="true" size={15} /></button>
                            <button type="button" onClick={() => placeAt(item.id, index + 1)} disabled={index === order.length - 1} aria-label={`Move ${item.shortLabel} down`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 disabled:opacity-30 dark:bg-black/20"><ChevronDown aria-hidden="true" size={15} /></button>
                            <button type="button" onClick={() => updateOrder(order.filter((candidate) => candidate !== item.id))} className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg bg-white/70 px-2 text-[10px] font-bold dark:bg-black/20"><Undo2 aria-hidden="true" size={13} /> Return</button>
                          </div>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="grid min-h-16 place-items-center rounded-xl border-2 border-dashed border-neutral-300 bg-white/50 text-xs font-semibold text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/40" aria-label={`Empty reasoning slot ${index + 1}`}>Drop step {index + 1} here</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <AnimatePresence mode="wait">
          {feedback !== "idle" && (
            <motion.div key={feedback} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-5 rounded-2xl border p-4 ${feedback === "correct" ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-50" : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"}`} role="status" aria-live="polite">
              <div className="flex items-start gap-3">{feedback === "correct" ? <Trophy aria-hidden="true" className="shrink-0 text-emerald-600" size={22} /> : <CircleHelp aria-hidden="true" className="shrink-0 text-amber-600" size={22} />}<div><p className="font-bold">{feedback === "correct" ? "Reasoning path complete" : feedback === "incomplete" ? "The chain still has open steps" : "Not quite — the path is still editable"}</p><p className="mt-1 text-sm leading-6 opacity-80">{feedback === "correct" ? "Nice — you reconstructed the intermediate reasoning sequence." : feedback === "incomplete" ? "Place every source-grounded piece before checking the sequence." : `The first ${correctPrefix} ${correctPrefix === 1 ? "step is" : "steps are"} in sequence. Rearrange the remaining cards and try again.`}</p></div></div>
            </motion.div>
          )}
        </AnimatePresence>

        {hintIndex >= 0 && <motion.p key={hintIndex} initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-50" role="status"><Lightbulb aria-hidden="true" className="mt-0.5 shrink-0 text-sky-600" size={17} /><span><strong>Hint {hintIndex + 1}:</strong> {CHAIN_OF_THOUGHT_DEMO_HINTS[hintIndex]}</span></motion.p>}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={submit} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:from-violet-800 hover:to-fuchsia-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"><Sparkles aria-hidden="true" size={17} /> Check reasoning path</button>
          {feedback === "incorrect" && <button type="button" onClick={() => setFeedback("idle")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-400 bg-white px-4 text-sm font-bold text-amber-800 dark:bg-neutral-950 dark:text-amber-200"><RefreshCw aria-hidden="true" size={16} /> Try again</button>}
          <button type="button" onClick={() => setHintIndex((value) => Math.min(CHAIN_OF_THOUGHT_DEMO_HINTS.length - 1, value + 1))} disabled={hintIndex >= CHAIN_OF_THOUGHT_DEMO_HINTS.length - 1} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-300 bg-white px-4 text-sm font-bold text-sky-800 disabled:opacity-40 dark:border-sky-800 dark:bg-neutral-950 dark:text-sky-200"><Lightbulb aria-hidden="true" size={16} /> Hint</button>
          <EvidenceButton evidence={evidence.mechanism} label="Show Figure 1 evidence" onNavigate={onNavigateEvidence} />
        </div>
      </div>
    </section>
  );
}

export default function ChainOfThoughtDemoExperience({ initialTab, evidence, onNavigateEvidence, onComplete }: Props) {
  const [tab, setTab] = useState<DemoTab>(initialTab);
  return (
    <div className="grid gap-5">
      <header className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-white via-violet-50 to-sky-50 p-5 shadow-sm dark:border-violet-900 dark:from-neutral-950 dark:via-violet-950/45 dark:to-sky-950/35 md:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-300/35 to-sky-300/35 blur-3xl dark:from-fuchsia-800/25 dark:to-sky-800/25" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Demo fast path</span><span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Source-grounded · instant</span></div><h1 className="mt-4 max-w-3xl text-balance text-2xl font-bold tracking-tight md:text-4xl">See the reasoning. Then rebuild it.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">A deterministic visual learning experience for <em>Chain-of-Thought Prompting Elicits Reasoning in Large Language Models</em>. The paper remains authoritative; this fast path makes no model call.</p></div>
          <div className="flex max-w-md items-start gap-3 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/75" role="status" aria-live="polite"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><BrainCircuit aria-hidden="true" size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Marginalia guide</p><p className="mt-1 text-sm font-medium leading-5">{tabCopy[tab]}</p></div></div>
        </div>
      </header>

      <nav className="mx-auto flex w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" aria-label="Chain-of-thought demo modes">
        {(["explore", "trace", "build"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} aria-current={tab === item ? "page" : undefined} className={`min-h-11 flex-1 rounded-xl px-3 text-xs font-bold uppercase tracking-[0.13em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${tab === item ? "bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white shadow-md" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"}`}>{item}</button>
        ))}
      </nav>

      {tab === "explore" && <><MechanismWalkthrough evidence={evidence} onNavigateEvidence={onNavigateEvidence} /><ResultComparison evidence={evidence} onNavigateEvidence={onNavigateEvidence} /></>}
      {tab === "trace" && <TraceWalkthrough evidence={evidence} onNavigateEvidence={onNavigateEvidence} />}
      {tab === "build" && <BuildReasoningGame evidence={evidence} onNavigateEvidence={onNavigateEvidence} onComplete={onComplete} />}
    </div>
  );
}
