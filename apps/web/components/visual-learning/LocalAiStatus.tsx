"use client";

import { Cpu, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LearningAiStatus } from "../../lib/ai/provider";
import { loadLearningAiStatus } from "../../lib/visual-learning/client";

export default function LocalAiStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<LearningAiStatus | null>(null);
  const refresh = useCallback(() => { void loadLearningAiStatus().then(setStatus); }, []);
  useEffect(refresh, [refresh]);

  const ready = status?.available;
  return (
    <div className={`rounded-lg border px-3 py-2 ${ready ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"}`} aria-live="polite">
      <div className="flex items-center gap-2">
        <Cpu aria-hidden="true" size={15} className={ready ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-500"} />
        <span className="text-xs font-semibold">Local AI · {status === null ? "Checking" : ready ? "Ready" : "Unavailable"}</span>
        <button type="button" onClick={refresh} className="ml-auto flex h-7 w-7 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-sky-600" aria-label="Refresh local AI status"><RefreshCw aria-hidden="true" size={13} /></button>
      </div>
      {!compact && <p className="mt-1 text-[11px] leading-4 text-neutral-600 dark:text-neutral-300">{ready ? `Model: ${status.model} · runs locally` : "Core reading and deterministic learning still work without Ollama."}</p>}
    </div>
  );
}
