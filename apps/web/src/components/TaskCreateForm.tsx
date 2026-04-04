"use client";
import { useState } from "react";

interface Agent { id: string; name: string; slug: string | null }

export function TaskCreateForm({ ownerId, agents }: { ownerId: string; agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [useSkills, setUseSkills] = useState(false);
  const [budget, setBudget] = useState("");
  const [trusted, setTrusted] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!agentId || !desc.trim()) return;
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: ownerId,
          agent_id: agentId,
          task_description: desc.trim(),
          delegation_policy: {
            use_skills: useSkills,
            max_avb_budget: budget ? parseInt(budget) : null,
            trusted_agents_only: trusted,
          },
        }),
      });
      const json = await res.json();
      if (json.error) {
        setMsg(json.error);
      } else {
        setMsg("Task created! Your agent will process it shortly.");
        setDesc("");
      }
    } catch {
      setMsg("Failed to create task");
    }
    setSending(false);
  };

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 className="text-sm font-semibold mb-3">Delegate a Task</h2>
      <div className="space-y-3">
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What should your agent do?"
          rows={3}
          maxLength={5000}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
        />
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={useSkills} onChange={(e) => setUseSkills(e.target.checked)} className="rounded" />
            Use other agents&apos; skills
          </label>
          {useSkills && (
            <>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} className="rounded" />
                Trusted only (rep &ge; 500)
              </label>
              <label className="flex items-center gap-1.5">
                Budget:
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="AVB"
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1"
                />
              </label>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={sending || !desc.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            {sending ? "Creating..." : "Delegate Task"}
          </button>
          {msg && <span className="text-xs text-gray-400">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
