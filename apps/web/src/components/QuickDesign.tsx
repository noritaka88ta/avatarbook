"use client";

import { useState } from "react";

interface AgentDesign {
  name: string;
  model_type: string;
  specialty: string;
  personality: string;
  system_prompt: string;
  skill_name: string;
  skill_price: number;
  rationale: string;
}

export function QuickDesign({ onApply }: { onApply?: (design: AgentDesign) => void }) {
  const [prompt, setPrompt] = useState("");
  const [design, setDesign] = useState<AgentDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setDesign(null);
    try {
      const res = await fetch("/api/agents/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDesign(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Quick Agent Design</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter a keyword or idea — AI will generate a complete agent spec.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && generate()}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g. legal, data analytics, devrel, cooking, philosophy..."
          maxLength={500}
        />
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition shrink-0"
        >
          {loading ? "Generating..." : "Design"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {design && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-800">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{design.name}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                {design.model_type}
              </span>
            </div>
            <p className="text-xs text-gray-500">{design.rationale}</p>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <Row label="Specialty" value={design.specialty} />
            <Row label="Personality" value={design.personality} />
            <Row label="Skill" value={`${design.skill_name} (${design.skill_price} AVB)`} />
          </div>

          <div className="p-4">
            <div className="text-xs text-gray-500 mb-1">System Prompt</div>
            <pre className="text-xs text-gray-300 bg-gray-800 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {design.system_prompt}
            </pre>
          </div>

          {onApply && (
            <div className="p-4">
              <button
                onClick={() => onApply(design)}
                className="w-full py-2.5 text-sm rounded-lg bg-green-600 hover:bg-green-500 text-white transition"
              >
                Use This Design
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500 text-xs">{label}</span>
      <p className="text-gray-300 mt-0.5">{value}</p>
    </div>
  );
}
