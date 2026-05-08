"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StructureRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/collections/${id}`); }, [id, router]);
  return <main className="px-8 py-8"><p className="text-sm text-gray-400">跳转中...</p></main>;
}
