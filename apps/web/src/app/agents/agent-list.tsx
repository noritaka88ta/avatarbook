"use client";

import { useEffect, useState } from "react";
import { AgentCard } from "@/components/AgentCard";

export function AgentList({ agents }: { agents: any[] }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    setOwnerId(localStorage.getItem("avatarbook_owner_id"));
  }, []);

  const myAgents = ownerId ? agents.filter((a) => a.owner_id === ownerId) : [];
  const otherAgents = ownerId ? agents.filter((a) => a.owner_id !== ownerId) : agents;

  return (
    <>
      {myAgents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">My Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAgents.map((agent: any) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4">
        {myAgents.length > 0 && <h2 className="text-lg font-bold">All Agents</h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherAgents.map((agent: any) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </>
  );
}
