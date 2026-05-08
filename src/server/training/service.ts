import { randomUUID } from "node:crypto";
import { listKnowledgeItems } from "../knowledge/repository";
import { createShareLink } from "../share/repository";
import { organizeKnowledge } from "../ai/organize";
import type { AIProvider, TrainingContent } from "../ai/types";
import { getFramework } from "./frameworks";
import {
  createTrainingPage,
  updateTrainingPage,
  saveVersionSnapshot,
  listVersions
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
    collectionId?: string | null;
    knowledgeItemIds: string[];
    shareExpiresAt?: Date;
  },
  provider: AIProvider
) {
  const knowledgeItems = await listKnowledgeItems(input.userId, input.collectionId);
  const selectedKnowledgeItems =
    input.knowledgeItemIds.length > 0
      ? knowledgeItems.filter((item) => input.knowledgeItemIds.includes(item.id))
      : knowledgeItems;

  if (selectedKnowledgeItems.length === 0) {
    throw new Error("No knowledge items found for training page generation");
  }

  const draftPage = await createTrainingPage({
    userId: input.userId,
    collectionId: input.collectionId,
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
      collectionId: trainingPage.collectionId,
      title: trainingPage.title,
      outline: JSON.parse(trainingPage.outlineJson ?? "[]") as string[],
      content: JSON.parse(trainingPage.contentJson ?? "[]") as string[],
      status: trainingPage.status,
      createdAt: trainingPage.createdAt,
      updatedAt: trainingPage.updatedAt
    },
    shareLink
  };
}

export async function generateTrainingSlides(
  input: {
    userId: string;
    collectionId?: string | null;
    knowledgeItemIds: string[];
    frameworkId: string;
    topic?: string;
    instruction?: string;
    previousPageId?: string;
  },
  provider: AIProvider
) {
  let effectiveCollectionId = input.collectionId;

  if (input.previousPageId && !effectiveCollectionId) {
    const { listRecentTrainingPages } = await import("./repository");
    const pages = await listRecentTrainingPages(input.userId, 100);
    const prev = pages.find((p) => p.id === input.previousPageId);
    effectiveCollectionId = prev?.collectionId ?? null;
  }

  const knowledgeItems = await listKnowledgeItems(input.userId, effectiveCollectionId);
  const selectedKnowledgeItems =
    input.knowledgeItemIds.length > 0
      ? knowledgeItems.filter((item) => input.knowledgeItemIds.includes(item.id))
      : knowledgeItems;

  if (selectedKnowledgeItems.length === 0) {
    throw new Error("没有找到可用于生成的素材");
  }

  const framework = await getFramework(input.frameworkId);
  if (!framework) {
    throw new Error(`未知框架: ${input.frameworkId}`);
  }

  let previousSlides: TrainingContent | undefined;
  let version = 1;

  if (input.previousPageId) {
    const { listRecentTrainingPages } = await import("./repository");
    const pages = await listRecentTrainingPages(input.userId, 100);
    const prev = pages.find((p) => p.id === input.previousPageId);
    if (prev?.slidesJson) {
      previousSlides = JSON.parse(prev.slidesJson);
      version = (prev.version ?? 1) + 1;
    }
  }

  const slides = await provider.generateSlides({
    fragments: selectedKnowledgeItems.map((item) => ({
      id: item.id,
      content: item.content
    })),
    framework: {
      id: framework.id,
      name: framework.name,
      structure: framework.structure
    },
    topic: input.topic,
    instruction: input.instruction,
    previousSlides
  });

  const slidesJson = JSON.stringify(slides);

  if (input.previousPageId) {
    // Save current snapshot before overwriting with new version
    if (previousSlides) {
      const prevVersion = version - 1;
      const existingSnapshots = await listVersions(input.previousPageId);
      const snapshotExists = existingSnapshots.some(s => s.version === prevVersion);
      if (!snapshotExists) {
        await saveVersionSnapshot({
          trainingPageId: input.previousPageId,
          version: prevVersion,
          instruction: prevVersion === 1 ? "首次生成" : (input.instruction ?? "迭代调整"),
          slidesJson: JSON.stringify(previousSlides)
        });
      }
    }

    const trainingPage = await updateTrainingPage(input.previousPageId, {
      title: slides.title,
      framework: input.frameworkId,
      slidesJson,
      totalMinutes: slides.totalMinutes,
      version,
      status: "ready"
    });

    const { listRecentTrainingPages } = await import("./repository");
    const pages = await listRecentTrainingPages(input.userId, 100);
    const updated = pages.find((p) => p.id === trainingPage.id);

    const shareLink = updated?.shareLink ?? null;

    return {
      trainingPage: {
        id: trainingPage.id,
        userId: trainingPage.userId,
        collectionId: trainingPage.collectionId,
        title: trainingPage.title,
        framework: trainingPage.framework,
        slidesJson: trainingPage.slidesJson,
        totalMinutes: trainingPage.totalMinutes,
        version: trainingPage.version,
        status: trainingPage.status,
        createdAt: trainingPage.createdAt,
        updatedAt: trainingPage.updatedAt
      },
      shareLink
    };
  }

  const draftPage = await createTrainingPage({
    userId: input.userId,
    collectionId: effectiveCollectionId,
    title: slides.title,
    framework: input.frameworkId,
    slidesJson,
    totalMinutes: slides.totalMinutes,
    status: "ready"
  });

  const shareLink = await createShareLink({
    trainingPageId: draftPage.id,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return {
    trainingPage: {
      id: draftPage.id,
      userId: draftPage.userId,
      collectionId: draftPage.collectionId,
      title: draftPage.title,
      framework: draftPage.framework,
      slidesJson: draftPage.slidesJson,
      totalMinutes: draftPage.totalMinutes,
      version: draftPage.version,
      status: draftPage.status,
      createdAt: draftPage.createdAt,
      updatedAt: draftPage.updatedAt
    },
    shareLink
  };
}
