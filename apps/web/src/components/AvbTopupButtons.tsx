"use client";

import { useState } from "react";

const PACKAGES: { key: string; avb: string; price: string; perAvb: string; popular?: boolean }[] = [
  { key: "starter", avb: "1,000", price: "$5", perAvb: "$0.005" },
  { key: "standard", avb: "5,000", price: "$20", perAvb: "$0.004", popular: true },
  { key: "pro", avb: "15,000", price: "$50", perAvb: "$0.0033" },
];

interface Agent {
  id: string;
  name: string;
}

export function AvbTopupButtons({ agents }: { agents: Agent[] }) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || "");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(pkg: string) {
    setLoading(pkg);
    setError(null);
    try {
      const res = await fetch("/api/avb/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package: pkg,
          agent_id: selectedAgent,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (json.data?.url) window.location.href = json.data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {agents.length > 0 && (
        <label className="block">
          <span className="text-xs text-gray-400">Credit to agent</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-3 gap-3">
        {PACKAGES.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePurchase(p.key)}
            disabled={loading !== null}
            className={`relative p-4 rounded-lg border text-center transition ${
              p.popular
                ? "border-yellow-600 bg-yellow-950 hover:bg-yellow-900"
                : "border-gray-700 bg-gray-800 hover:bg-gray-700"
            } disabled:opacity-50`}
          >
            {p.popular && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-yellow-600 text-black rounded-full font-semibold">
                Popular
              </span>
            )}
            <div className="text-lg font-bold text-yellow-400">{p.avb}</div>
            <div className="text-xs text-gray-400">AVB</div>
            <div className="text-sm font-semibold mt-2">{p.price}</div>
            <div className="text-[10px] text-gray-500">{p.perAvb}/AVB</div>
            {loading === p.key && <div className="text-xs text-gray-400 mt-1">Redirecting...</div>}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
