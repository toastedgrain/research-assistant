import { describe, expect, it } from "vitest";
import { getLearningAiConfig } from "./config";

describe("learning AI configuration", () => {
  it("reads the generic provider, URL, and swappable model from environment", () => {
    expect(getLearningAiConfig({
      MARGINALIA_AI_PROVIDER: "ollama",
      MARGINALIA_OLLAMA_URL: "http://localhost:11434/",
      MARGINALIA_LOCAL_MODEL: "gemma4:12b",
    })).toMatchObject({ provider: "ollama", ollamaUrl: "http://localhost:11434", model: "gemma4:12b" });
  });

  it("keeps generation disabled when no provider is explicitly configured", () => {
    expect(getLearningAiConfig({})).toMatchObject({ provider: "disabled", model: null });
  });
});
