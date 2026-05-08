import { redirect } from "next/navigation";
import { listCollections } from "@/server/collection/repository";

export default async function HomePage() {
  const collections = await listCollections("demo-user");
  if (collections.length > 0) {
    redirect(`/collections/${collections[0].id}`);
  }
  redirect("/unassigned");
}
