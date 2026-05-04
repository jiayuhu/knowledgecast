import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { userFrameworks } from "../db/schema";

export type Framework = {
  id: string;
  name: string;
  structure: string[];
  description: string;
  icon: string;
  isCustom?: boolean;
};

export const BUILT_IN_FRAMEWORKS: Framework[] = [
  {
    id: "problem-solving",
    name: "问题解决型",
    structure: ["痛点", "分析", "方案", "案例", "行动"],
    description: "适用于售前宣讲、咨询提案，从问题切入引出解决方案",
    icon: "lightbulb"
  },
  {
    id: "concept-explaining",
    name: "概念讲解型",
    structure: ["是什么", "为什么", "怎么做", "常见误区", "总结"],
    description: "适用于知识科普、新员工培训，从概念到落地循序渐进",
    icon: "book"
  },
  {
    id: "experience-sharing",
    name: "经验分享型",
    structure: ["背景", "经历", "反思", "方法论", "建议"],
    description: "适用于复盘总结、个人经验分享，故事化呈现",
    icon: "chat"
  },
  {
    id: "skill-teaching",
    name: "技能教学型",
    structure: ["学习目标", "前置知识", "步骤拆解", "动手练习", "效果检查"],
    description: "适用于实操培训、Workshop，强调动手和验证",
    icon: "wrench"
  },
  {
    id: "product-introducing",
    name: "产品介绍型",
    structure: ["用户问题", "解决方案", "核心功能", "产品演示", "客户价值"],
    description: "适用于产品发布、销售赋能，围绕用户价值展开",
    icon: "package"
  }
];

export async function getFramework(id: string): Promise<Framework | undefined> {
  const builtIn = BUILT_IN_FRAMEWORKS.find((f) => f.id === id);
  if (builtIn) return builtIn;

  // 查自定义框架
  const db = await getDb();
  const rows = await db
    .select()
    .from(userFrameworks)
    .where(eq(userFrameworks.id, id))
    .all();
  const row = rows[0];
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    structure: JSON.parse(row.structureJson) as string[],
    description: row.description ?? "",
    icon: "custom",
    isCustom: true
  };
}

export async function listUserFrameworks(userId: string): Promise<Framework[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(userFrameworks)
    .where(eq(userFrameworks.userId, userId))
    .orderBy(desc(userFrameworks.createdAt))
    .all();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    structure: JSON.parse(r.structureJson) as string[],
    description: r.description ?? "",
    icon: "custom",
    isCustom: true
  }));
}

export async function createUserFramework(
  userId: string,
  input: { name: string; structure: string[]; description?: string }
) {
  const db = await getDb();
  const now = new Date();
  const record = {
    id: randomUUID(),
    userId,
    name: input.name,
    structureJson: JSON.stringify(input.structure),
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now
  };
  await db.insert(userFrameworks).values(record).run();
  return {
    id: record.id,
    name: record.name,
    structure: input.structure,
    description: input.description ?? "",
    icon: "custom",
    isCustom: true
  };
}

export async function updateUserFramework(
  id: string,
  input: { name?: string; structure?: string[]; description?: string | null }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) values.name = input.name;
  if (input.structure !== undefined) values.structureJson = JSON.stringify(input.structure);
  if (input.description !== undefined) values.description = input.description;
  await db.update(userFrameworks).set(values).where(eq(userFrameworks.id, id)).run();
}

export async function deleteUserFramework(id: string) {
  const db = await getDb();
  await db.delete(userFrameworks).where(eq(userFrameworks.id, id)).run();
}
