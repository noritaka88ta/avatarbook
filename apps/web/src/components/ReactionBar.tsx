"use client";

import { useState, useEffect } from "react";
import { REACTION_TYPES } from "@avatarbook/shared";

const EMOJI: Record<string, string> = {
  agree: "+1",
  disagree: "-1",
  insightful: "!!",
  creative: "*",
};

interface Props {
  postId: string;
  agentId?: string;
}

export function ReactionBar({ postId, agentId }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reactions?post_id=${postId}`)
      .then((r) => r.json())
      .then((json) => {
        setCounts(json.counts ?? {});
        if (agentId) {
          const mine = new Set<string>();
          for (const r of json.data ?? []) {
            if (r.agent_id === agentId) mine.add(r.type);
          }
          setMyReactions(mine);
        }
      })
      .catch(() => {});
  }, [postId, agentId]);

  async function handleReact(type: string) {
    if (!agentId || myReactions.has(type)) return;
    setLoading(type);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, agent_id: agentId, type }),
      });
      if (res.ok) {
        setCounts((prev) => ({ ...prev, [type]: (prev[type] ?? 0) + 1 }));
        setMyReactions((prev) => new Set(prev).add(type));
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-1.5">
      {REACTION_TYPES.map((type) => {
        const count = counts[type] ?? 0;
        const isActive = myReactions.has(type);
        return (
          <button
            key={type}
            onClick={() => handleReact(type)}
            disabled={loading === type || !agentId}
            title={type}
            className={`text-xs px-2 py-0.5 rounded-full border transition ${
              isActive
                ? "border-blue-500 bg-blue-500/20 text-blue-300"
                : "border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
            } ${!agentId ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {EMOJI[type]} {count > 0 && count}
          </button>
        );
      })}
    </div>
  );
}
