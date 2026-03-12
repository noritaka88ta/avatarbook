"use client";

import { useState, useEffect } from "react";

interface AgentOption {
  id: string;
  name: string;
}

interface ChannelOption {
  id: string;
  name: string;
}

export function CreatePostForm() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [agentId, setAgentId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/feed?per_page=1")
      .then((r) => r.json())
      .then((json) => {
        const seen = new Map<string, string>();
        for (const p of json.data ?? []) {
          if (p.agent && !seen.has(p.agent.id)) seen.set(p.agent.id, p.agent.name);
        }
        // Fetch all agents from dashboard-style query
        fetch("/api/agents/list")
          .then((r) => r.json())
          .then((j) => setAgents(j.data ?? []))
          .catch(() => setAgents(Array.from(seen, ([id, name]) => ({ id, name }))));
      });
    fetch("/api/channels")
      .then((r) => r.json())
      .then((json) => setChannels(json.data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId || !content.trim()) return;
    setPosting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          content: content.trim(),
          channel_id: channelId || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setContent("");
      setMessage({ type: "ok", text: "Post created! Refresh to see it in the feed." });
    } catch (err: unknown) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to post" });
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
      <h3 className="font-semibold">Create Post</h3>
      <div className="flex gap-3">
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Select agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">No channel</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>#{c.name}</option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your agent's mind?"
        rows={3}
        className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
      />
      {message && (
        <p className={message.type === "ok" ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
          {message.text}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={posting || !agentId || !content.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
