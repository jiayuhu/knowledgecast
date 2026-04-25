import { randomUUID } from "node:crypto";
import { listKnowledgeItems } from "../knowledge/repository";
import { createShareLink } from "../share/repository";
import { organizeKnowledge } from "../ai/organize";
import type { AIProvider } from "../ai/types";
import {
  createTrainingPage,
  updateTrainingPage
} from "./repository";

function buildContentBlocks(input: {
  title: string;
  outline: string[];
  followUpQuestions: string[];
  fragments: Array<{ content: string }>;
}) {
  const fragmentSummary = input.fragments
    .map((fragment, index) => `${index + 1}. ${fragment.content.trim()}`)
    .filter((item) => item.length > 0);

  return [
    `Training focus: ${input.title}`,
    `Outline: ${input.outline.join(" · ")}`,
    input.followUpQuestions.length > 0
      ? `Open questions: ${input.followUpQuestions.join(" · ")}`
      : "Open questions: None",
    fragmentSummary.length > 0
      ? `Source notes:\n${fragmentSummary.join("\n")}`
      : "Source notes: None"
  ];
}

export async function generateTrainingPage(
  input: {
    userId: string;
    knowledgeItemIds: string[];
    shareExpiresAt?: Date;
  },
  provider: AIProvider
) {
  const knowledgeItems = await listKnowledgeItems(input.userId);
  const selectedKnowledgeItems =
    input.knowledgeItemIds.length > 0
      ? knowledgeItems.filter((item) => input.knowledgeItemIds.includes(item.id))
      : knowledgeItems;

  if (selectedKnowledgeItems.length === 0) {
    throw new Error("No knowledge items found for training page generation");
  }

  const draftPage = await createTrainingPage({
    userId: input.userId,
    title: "Generating...",
    outline: [],
    content: [],
    status: "processing"
  });

  const organization = await organizeKnowledge(
    selectedKnowledgeItems.map((item) => ({
      id: item.id,
      content: item.content
    })),
    provider
  );

  const content = buildContentBlocks({
    title: organization.title,
    outline: organization.outline,
    followUpQuestions: organization.followUpQuestions,
    fragments: selectedKnowledgeItems
  });

  const trainingPage = await updateTrainingPage(draftPage.id, {
    title: organization.title,
    outline: organization.outline,
    content,
    status: "ready"
  });

  const shareLink = await createShareLink({
    trainingPageId: trainingPage.id,
    token: randomUUID(),
    expiresAt:
      input.shareExpiresAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return {
    trainingPage: {
      id: trainingPage.id,
      userId: trainingPage.userId,
      title: trainingPage.title,
      outline: JSON.parse(trainingPage.outlineJson) as string[],
      content: JSON.parse(trainingPage.contentJson) as string[],
      status: trainingPage.status,
      createdAt: trainingPage.createdAt,
      updatedAt: trainingPage.updatedAt
    },
    shareLink
  };
}
