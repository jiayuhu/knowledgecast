import { redirect } from "next/navigation";
import { listWorkspaces } from "@/server/workspace/repository";

export default async function HomePage() {
  const workspaces = await listWorkspaces("demo-user");
  if (workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].id}`);
  }
  redirect("/workspace/capture");
}
