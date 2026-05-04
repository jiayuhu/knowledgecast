import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BUILT_IN_FRAMEWORKS,
  listUserFrameworks,
  createUserFramework,
  updateUserFramework,
  deleteUserFramework
} from "@/server/training/frameworks";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "demo-user";

  const custom = await listUserFrameworks(userId);
  const frameworks = [...BUILT_IN_FRAMEWORKS, ...custom];

  return NextResponse.json({ frameworks });
}

const createSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(30),
  structure: z.array(z.string().min(1)).min(1).max(10),
  description: z.string().optional()
});

export async function POST(request: Request) {
  const payload = createSchema.parse(await request.json());
  const framework = await createUserFramework(payload.userId, {
    name: payload.name,
    structure: payload.structure,
    description: payload.description
  });
  return NextResponse.json({ framework });
}
