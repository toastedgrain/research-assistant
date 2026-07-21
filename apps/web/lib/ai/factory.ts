import { getLearningAiConfig } from "./config";
import { OllamaLearningProvider } from "./ollama-provider";
import type { LearningGenerationProvider } from "./provider";

export function createLearningGenerationProvider(): LearningGenerationProvider {
  return new OllamaLearningProvider(getLearningAiConfig());
}
