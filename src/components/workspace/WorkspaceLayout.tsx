"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { WorkspaceNav } from "./WorkspaceNav";

type Area = { id: string; name: string; userId: string };
type Workspace = { id: string; name: string; areaId: string | null; userId: string };

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [userId] = useState("demo-user");
  const [area, setArea] = useState<Area | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem("knowledgecast_workspace_id");
    if (savedId) {
      fetch("/api/workspaces?userId=demo-user")
        .then((r) => r.json())
        .then((data) => {
          const list = (data.workspaces ?? []) as Workspace[];
          const found = list.find((w) => w.id === savedId);
          if (found) setWorkspace(found);
        });
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <WorkspaceNav
        workspaceId={workspace?.id}
        workspaceName={workspace?.name}
        areaName={area?.name}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          userId={userId}
          activeAreaId={area?.id ?? null}
          activeWorkspaceId={workspace?.id ?? null}
          onAreaChange={setArea}
          onWorkspaceChange={setWorkspace}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
