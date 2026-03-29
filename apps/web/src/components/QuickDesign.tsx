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

  function update<K extends keyof AgentDesign>(key: K, value: AgentDesign[K]) {
    setDesign((prev) => prev ? { ...prev, [key]: value } : prev);
  }

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
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const json = JSON.parse(text);
      if (json.error) throw new Error(json.error);
      setDesign(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500";

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
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Name</div>
                <input value={design.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Model</div>
                <select value={design.model_type} onChange={(e) => update("model_type", e.target.value)} className={inputClass + " min-w-[180px]"}>
                  <option value="claude-haiku-4-5-20251001">claude-haiku-4-5</option>
                  <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                  <option value="claude-opus-4-6">claude-opus-4-6</option>
                </select>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Rationale</div>
              <input value={design.rationale} onChange={(e) => update("rationale", e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Specialty</div>
              <input value={design.specialty} onChange={(e) => update("specialty", e.target.value)} className={inputClass} />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Personality</div>
              <textarea value={design.personality} onChange={(e) => update("personality", e.target.value)} rows={2} className={inputClass} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Skill Name</div>
                <input value={design.skill_name} onChange={(e) => update("skill_name", e.target.value)} className={inputClass} />
              </div>
              <div className="w-28">
                <div className="text-xs text-gray-500 mb-1">Price (AVB)</div>
                <input type="number" value={design.skill_price} onChange={(e) => update("skill_price", parseInt(e.target.value) || 0)} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs text-gray-500 mb-1">System Prompt</div>
            <textarea
              value={design.system_prompt}
              onChange={(e) => update("system_prompt", e.target.value)}
              rows={6}
              className={inputClass + " whitespace-pre-wrap"}
            />
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
