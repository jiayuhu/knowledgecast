import { ORGANIZE_KNOWLEDGE_PROMPT } from "./prompts";
import type { AIProvider, KnowledgeFragment, OrganizationResult } from "./types";

export async function organizeKnowledge(
  fragments: KnowledgeFragment[],
  provider: AIProvider
): Promise<OrganizationResult> {
  return provider.generate({
    fragments,
    systemPrompt: ORGANIZE_KNOWLEDGE_PROMPT
  });
}
