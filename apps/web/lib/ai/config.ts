export type MarginaliaAiProviderName = "ollama" | "disabled";

export interface LearningAiConfig {
  provider: MarginaliaAiProviderName;
  ollamaUrl: string;
  model: string | null;
  timeoutMs: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Server-side accessor; components and prompts never hard-code a model or host. */
export function getLearningAiConfig(env: Record<string, string | undefined> = process.env): LearningAiConfig {
  const selected = env.MARGINALIA_AI_PROVIDER?.trim().toLocaleLowerCase();
  const provider: MarginaliaAiProviderName = selected === "ollama" ? "ollama" : "disabled";
  return {
    provider,
    ollamaUrl: (env.MARGINALIA_OLLAMA_URL?.trim() || "http://localhost:11434").replace(/\/$/, ""),
    model: env.MARGINALIA_LOCAL_MODEL?.trim() || null,
    timeoutMs: positiveInteger(env.MARGINALIA_AI_TIMEOUT_MS, 120_000),
  };
}
