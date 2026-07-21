"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { Beaker, BookOpen, Boxes, Database, FileText, FlaskConical, GitBranch, Image, LocateFixed, Microscope, Quote, Table2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { SourceEvidence } from "../../lib/evidence/source";
import type { ResearchGraph, ResearchGraphNode } from "../../lib/explore/graph";

interface EvidenceNodeData extends Record<string, unknown> {
  label: string;
  type: ResearchGraphNode["type"];
  provenance: string;
  newlyShown: boolean;
}

function NodeIcon({ type }: { type: ResearchGraphNode["type"] }) {
  const props = { size: 15, "aria-hidden": true } as const;
  if (type === "claim") return <Quote {...props} />;
  if (type === "figure") return <Image {...props} />;
  if (type === "table") return <Table2 {...props} />;
  if (type === "experiment") return <FlaskConical {...props} />;
  if (type === "method") return <Beaker {...props} />;
  if (type === "result") return <Microscope {...props} />;
  if (type === "dataset" || type === "benchmark") return <Database {...props} />;
  if (type === "citation" || type === "paper") return <BookOpen {...props} />;
  if (type === "limitation") return <TriangleAlert {...props} />;
  if (type === "concept") return <GitBranch {...props} />;
  if (type === "evidence" || type === "passage") return <FileText {...props} />;
  return <Boxes {...props} />;
}

function EvidenceNode({ data }: NodeProps<Node<EvidenceNodeData>>) {
  return (
    <motion.div
      initial={data.newlyShown ? { opacity: 0, scale: 0.92 } : false}
      animate={{ opacity: 1, scale: 1 }}
      className={`min-w-44 max-w-60 rounded-xl border-2 bg-white px-3 py-3 shadow-md dark:bg-neutral-950 ${data.provenance === "generated" ? "border-dashed border-violet-500" : data.provenance === "user" ? "border-dotted border-amber-600" : "border-sky-600"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-sky-600" />
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500"><NodeIcon type={data.type} />{data.type} · {data.provenance}</p>
      <p className="mt-1 text-sm font-semibold leading-5">{data.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-sky-600" />
    </motion.div>
  );
}

const nodeTypes = { evidence: EvidenceNode };

function initialNodeIds(graph: ResearchGraph, rootId: string): Set<string> {
  const ids = new Set([rootId]);
  for (const edge of graph.edges.filter((item) => item.source === rootId && ["supports", "qualifies"].includes(item.type))) ids.add(edge.target);
  return ids;
}

function position(index: number, count: number) {
  if (index === 0) return { x: 40, y: Math.max(90, (count - 1) * 45) };
  const column = 1 + Math.floor((index - 1) / 5);
  const row = (index - 1) % 5;
  return { x: column * 290, y: row * 135 };
}

interface Props {
  graph: ResearchGraph;
  rootId: string;
  onShowEvidence: (evidence: SourceEvidence) => void;
  forceReducedMotion?: boolean;
}

export default function EvidenceGraphCanvas({ graph, rootId, onShowEvidence, forceReducedMotion }: Props) {
  const systemReduced = useReducedMotion();
  const reducedMotion = forceReducedMotion ?? systemReduced ?? false;
  const [visible, setVisible] = useState(() => initialNodeIds(graph, rootId));
  const [previous, setPrevious] = useState(() => new Set(visible));
  const [focused, setFocused] = useState<string | null>(null);

  const expand = (types: string[]) => {
    setPrevious(new Set(visible));
    setVisible((current) => {
      const next = new Set(current);
      for (const edge of graph.edges) {
        if (!types.includes(edge.type)) continue;
        if (next.has(edge.source)) next.add(edge.target);
        if (next.has(edge.target)) next.add(edge.source);
      }
      return next;
    });
  };

  const shownNodes = graph.nodes.filter((node) => visible.has(node.id) && (!focused || node.id === focused || graph.edges.some((edge) => (edge.source === focused && edge.target === node.id) || (edge.target === focused && edge.source === node.id))));
  const shownIds = new Set(shownNodes.map((node) => node.id));
  const shownEdges = graph.edges.filter((edge) => shownIds.has(edge.source) && shownIds.has(edge.target));
  const nodes = useMemo<Node<EvidenceNodeData>[]>(() => shownNodes.map((node, index) => ({
    id: node.id,
    type: "evidence",
    position: position(index, shownNodes.length),
    data: { label: node.label, type: node.type, provenance: node.provenance ?? "literal", newlyShown: !reducedMotion && !previous.has(node.id) },
    ariaLabel: `${node.type}: ${node.label}. Provenance ${node.provenance ?? "literal"}.${node.source ? " Opens exact source." : ""}`,
    focusable: true,
  })), [previous, reducedMotion, shownNodes]);
  const edges = useMemo<Edge[]>(() => shownEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: `${edge.type} · ${edge.provenance}`,
    animated: !reducedMotion && edge.provenance === "literal",
    style: {
      strokeWidth: 2,
      stroke: edge.provenance === "generated" ? "#8b5cf6" : edge.provenance === "user" ? "#d97706" : "#0284c7",
      strokeDasharray: edge.provenance === "generated" ? "7 5" : edge.provenance === "user" ? "2 5" : undefined,
    },
    labelStyle: { fontSize: 10, fill: "currentColor" },
  })), [reducedMotion, shownEdges]);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950" aria-label="Interactive scientific evidence graph">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800"><p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Claim → evidence → experiment → method → result → citation</p><h2 className="mt-1 text-base font-semibold">Trace this claim</h2><p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">Solid edges are literal source relationships. Dashed edges are generated candidates. Dotted edges are user-created.</p></header>
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-3 dark:border-neutral-800" aria-label="Evidence graph expansion controls">
        <button type="button" onClick={() => expand(["supports", "qualifies"])} className="min-h-9 rounded-md border px-3 text-xs">Expand support</button>
        <button type="button" onClick={() => expand(["contains", "uses-method", "reports-result", "evaluated-on", "compares-against"])} className="min-h-9 rounded-md border px-3 text-xs">Expand method & experiment</button>
        <button type="button" onClick={() => expand(["cites", "extends"])} className="min-h-9 rounded-md border px-3 text-xs">Trace to origin</button>
        <button type="button" onClick={() => { setVisible(new Set(graph.nodes.slice(0, 24).map((node) => node.id))); setFocused(null); }} className="min-h-9 rounded-md border px-3 text-xs">Expand bounded graph</button>
        {focused && <button type="button" onClick={() => setFocused(null)} className="min-h-9 rounded-md border border-sky-700 px-3 text-xs text-sky-800 dark:text-sky-300">Exit focus mode</button>}
      </div>
      <div className="h-[min(540px,60vh)] min-h-[380px]" role="application" aria-label="Pan and zoom evidence graph">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.25, duration: reducedMotion ? 0 : 350 }} nodesConnectable={false} onNodeDoubleClick={(_event, node) => setFocused(node.id)} onNodeClick={(_event, node) => { const source = graph.nodes.find((item) => item.id === node.id)?.source; if (source) onShowEvidence(source); }} proOptions={{ hideAttribution: true }}>
          <Background gap={22} size={1} color="#94a3b8" /><Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <details className="border-t border-neutral-200 p-4 dark:border-neutral-800"><summary className="cursor-pointer text-sm font-medium">Accessible graph list</summary><ul className="mt-3 grid gap-2">{shownNodes.map((node) => <li key={node.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase">{node.type} · {node.provenance ?? "literal"}</span>{node.source && <button type="button" onClick={() => onShowEvidence(node.source as SourceEvidence)} className="ml-auto flex min-h-8 items-center gap-1 text-xs text-sky-700"><LocateFixed aria-hidden="true" size={13} />Show evidence</button>}</div><p className="mt-1 text-sm">{node.label}</p><ul className="mt-2 text-xs text-neutral-500">{shownEdges.filter((edge) => edge.source === node.id).map((edge) => <li key={edge.id}>{edge.type} ({edge.provenance}) → {graph.nodes.find((item) => item.id === edge.target)?.label}</li>)}</ul></li>)}</ul></details>
    </section>
  );
}
