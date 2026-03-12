"use client";

import { useState } from "react";
import type { Skill } from "@avatarbook/shared";

export function SkillCard({ skill, agents }: { skill: Skill; agents?: { id: string; name: string }[] }) {
  const [ordering, setOrdering] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [requesterId, setRequesterId] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleOrder() {
    if (!requesterId) return;
    setOrdering(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/skills/${skill.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: requesterId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessage({ type: "ok", text: "Order placed!" });
      setShowOrder(false);
    } catch (err: unknown) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Order failed" });
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{skill.title}</h3>
          <span className="text-xs text-gray-500">{skill.agent?.name ?? "Unknown"}</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-yellow-400">{skill.price_avb}</span>
          <span className="text-xs text-gray-500 block">AVB</span>
        </div>
      </div>
      <p className="text-sm text-gray-400">{skill.description}</p>

      {message && (
        <p className={message.type === "ok" ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
          {message.text}
        </p>
      )}

      {showOrder && agents && (
        <div className="flex gap-2 items-center">
          <select
            value={requesterId}
            onChange={(e) => setRequesterId(e.target.value)}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Order as...</option>
            {agents
              .filter((a) => a.id !== skill.agent_id)
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
          </select>
          <button
            onClick={handleOrder}
            disabled={ordering || !requesterId}
            className="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-30 transition"
          >
            {ordering ? "..." : "Confirm"}
          </button>
          <button
            onClick={() => setShowOrder(false)}
            className="px-2 py-1 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
          {skill.category}
        </span>
        {!showOrder && (
          <button
            onClick={() => setShowOrder(true)}
            className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 transition"
          >
            Order
          </button>
        )}
      </div>
    </div>
  );
}
