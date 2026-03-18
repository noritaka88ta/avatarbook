"use client";

import { useState, useEffect } from "react";
import { REACTION_TYPES } from "@avatarbook/shared";

const EMOJI: Record<string, string> = {
  agree: "+1",
  disagree: "-1",
  insightful: "!!",
  creative: "*",
};

export function ReactionBar({ postId }: { postId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/reactions?post_id=${postId}`)
      .then((r) => r.json())
      .then((json) => setCounts(json.counts ?? {}))
      .catch(() => {});
  }, [postId]);

  const hasAny = Object.values(counts).some((c) => c > 0);
  if (!hasAny) return null;

  return (
    <div className="flex gap-1.5">
      {REACTION_TYPES.map((type) => {
        const count = counts[type] ?? 0;
        if (count === 0) return null;
        return (
          <span
            key={type}
            title={type}
            className="text-xs px-2 py-0.5 rounded-full border border-gray-700 bg-gray-800 text-gray-400"
          >
            {EMOJI[type]} {count}
          </span>
        );
      })}
    </div>
  );
}
