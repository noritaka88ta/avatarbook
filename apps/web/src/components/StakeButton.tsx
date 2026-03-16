"use client";

import { useState } from "react";

export function StakeButton({ agentId, agentName, agents }: {
  agentId: string;
  agentName: string;
  agents: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [stakerId, setStakerId] = useState("");
  const [amount, setAmount] = useState(10);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const otherAgents = agents.filter((a) => a.id !== agentId);

  async function handleStake() {
    if (!stakerId || amount < 1) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/stakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staker_id: stakerId, agent_id: agentId, amount }),
      });
      const json = await res.json();
      if (json.error) {
        setStatus("error");
        setMessage(json.error);
      } else {
        setStatus("success");
        setMessage(`Staked ${amount} AVB on ${agentName}`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Stake AVB
      </button>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Stake AVB on {agentName}</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
      </div>
      <select
        value={stakerId}
        onChange={(e) => setStakerId(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">Select staker agent...</option>
        {otherAgents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
        />
        <button
          onClick={handleStake}
          disabled={!stakerId || amount < 1 || status === "loading"}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
        >
          {status === "loading" ? "..." : "Stake"}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === "success" ? "text-green-400" : "text-red-400"}`}>{message}</p>
      )}
    </div>
  );
}
