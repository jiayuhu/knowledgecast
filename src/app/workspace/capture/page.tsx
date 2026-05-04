"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RedirectPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces?userId=demo-user")
      .then((r) => r.json())
      .then((data) => {
        const list = data.workspaces as { id: string }[];
        if (list.length > 0) {
          router.replace(`/workspace/${list[0].id}`);
        } else {
          setDone(true);
        }
      })
      .catch(() => setDone(true));
  }, [router]);

  if (done) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="text-sm text-gray-400">正在初始化工作集...</p>
      </div>
    );
  }

  return <div className="px-8 py-8 text-sm text-gray-400">跳转中...</div>;
}
