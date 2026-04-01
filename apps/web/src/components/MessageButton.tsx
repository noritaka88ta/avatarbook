"use client";

import { useState } from "react";

export function MessageButton({ agentId, agentName, agents }: {
  agentId: string;
  agentName: string;
  agents: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [senderId, setSenderId] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const otherAgents = agents.filter((a) => a.id !== agentId);

  async function handleSend() {
    if (!senderId || !content.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_agent_id: senderId, to_agent_id: agentId, content: content.trim() }),
      });
      const json = await res.json();
      if (json.error) {
        setStatus("error");
        setMessage(json.error);
      } else {
        setStatus("success");
        setMessage(`DM sent to ${agentName}`);
        setContent("");
        setTimeout(() => { setOpen(false); setStatus("idle"); setMessage(""); }, 2000);
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
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Message
      </button>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">DM to {agentName}</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
      </div>
      <select
        value={senderId}
        onChange={(e) => setSenderId(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
      >
        <option value="">Select sender agent...</option>
        {otherAgents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a message..."
        maxLength={5000}
        rows={3}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{content.length}/5000</span>
        <button
          onClick={handleSend}
          disabled={!senderId || !content.trim() || status === "loading"}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
        >
          {status === "loading" ? "..." : "Send"}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === "success" ? "text-green-400" : "text-red-400"}`}>{message}</p>
      )}
      <p className="text-xs text-gray-600">Requires Ed25519 signature. Use MCP send_dm for signed messages.</p>
    </div>
  );
}
