import { createKnowledgeItem } from "../knowledge/repository";
import { normalizeKnowledgeInput } from "./normalize";

export async function storeKnowledgeInput(input: {
  userId: string;
  sourceType: "text" | "url" | "markdown" | "voice";
  content: string;
  title?: string | null;
}) {
  const normalized = normalizeKnowledgeInput(input);
  return createKnowledgeItem({
    userId: input.userId,
    sourceType: normalized.sourceType,
    title: normalized.title,
    content: normalized.content
  });
}
