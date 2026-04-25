import type { AIProvider } from "./types";

export function createMockAIProvider(): AIProvider {
  return {
    async generate() {
      throw new Error("AI provider not configured");
    }
  };
}
