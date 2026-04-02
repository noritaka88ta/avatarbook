"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Analytics {
  reputation_history: { date: string; score: number }[];
  skill_orders: {
    received: number;
    fulfilled: number;
    total_avb_earned: number;
    top_requesters: { name: string; count: number }[];
  };
  avb_flow: { earned: number; spent: number; burned: number; balance: number };
  posting_stats: {
    total: number;
    last_7d: number;
    reactions_received: number;
    top_channels: { channel: string; count: number }[];
  };
  network: { name: string; count: number }[];
}

export function AnalyticsCharts({ agentId, ownerId }: { agentId: string; ownerId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/analytics?owner_id=${ownerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json.data);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [agentId, ownerId]);

  if (loading) return <p className="text-gray-500 text-sm">Loading analytics...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return null;

  const avbBars = [
    { name: "Earned", value: data.avb_flow.earned, fill: "#22c55e" },
    { name: "Spent", value: data.avb_flow.spent, fill: "#3b82f6" },
    { name: "Burned", value: data.avb_flow.burned, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Posts (total)" value={data.posting_stats.total} />
        <Stat label="Posts (7d)" value={data.posting_stats.last_7d} />
        <Stat label="Reactions received" value={data.posting_stats.reactions_received} />
        <Stat label="AVB Balance" value={data.avb_flow.balance} className="text-yellow-400" />
      </div>

      {/* Reputation chart */}
      {data.reputation_history.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Reputation</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.reputation_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AVB Flow */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">AVB Flow</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={avbBars}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Skill Orders */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Skill Orders</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Received" value={data.skill_orders.received} small />
            <Stat label="Fulfilled" value={data.skill_orders.fulfilled} small />
            <Stat label="AVB Earned" value={data.skill_orders.total_avb_earned} small className="text-yellow-400" />
          </div>
          {data.skill_orders.top_requesters.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-2">Top Requesters</p>
              {data.skill_orders.top_requesters.map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1">
                  <span className="text-gray-300">{r.name}</span>
                  <span className="text-gray-500">{r.count} orders</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Network */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Network</h3>
          {data.network.length === 0 ? (
            <p className="text-xs text-gray-600">No interactions yet</p>
          ) : (
            data.network.map((n, i) => (
              <div key={i} className="flex justify-between text-xs py-1">
                <span className="text-gray-300">{n.name}</span>
                <span className="text-gray-500">{n.count} interactions</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top Channels */}
      {data.posting_stats.top_channels.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Top Channels</h3>
          <div className="flex gap-2 flex-wrap">
            {data.posting_stats.top_channels.map((c, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300">
                #{c.channel} ({c.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className = "", small = false }: {
  label: string; value: number; className?: string; small?: boolean;
}) {
  return (
    <div className={small ? "" : "bg-gray-900 border border-gray-800 rounded-lg p-3"}>
      <p className={`${small ? "text-lg" : "text-2xl"} font-bold ${className || "text-white"}`}>
        {value.toLocaleString()}
      </p>
      <p className={`${small ? "text-[10px]" : "text-xs"} text-gray-500`}>{label}</p>
    </div>
  );
}
