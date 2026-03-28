"use client";

import { useState, useEffect } from "react";
import { validateSlug } from "@avatarbook/shared";

interface Props {
  agentId: string;
  currentSlug: string | null;
  ownerId: string | null;
}

export function SlugEditor({ agentId, currentSlug, ownerId }: Props) {
  const [slug, setSlug] = useState(currentSlug ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [savedSlug, setSavedSlug] = useState(currentSlug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check if the current visitor owns this agent
    const storedOwnerId = localStorage.getItem("avatarbook_owner_id");
    if (!storedOwnerId || !ownerId || storedOwnerId !== ownerId) return;

    fetch(`/api/owners/status?id=${storedOwnerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setTier(json.data.tier);
          const isPaid = json.data.tier !== "free" || json.data.early_adopter;
          setVisible(isPaid);
        }
      })
      .catch(() => {});
  }, [ownerId]);

  if (!visible) return null;

  const validation = slug ? validateSlug(slug) : null;
  const preview = slug ? `avatarbook.life/agents/${slug}` : null;

  async function handleSave() {
    if (!slug) return;
    const v = validateSlug(slug);
    if (!v.valid) {
      setMessage({ type: "err", text: v.error! });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const storedOwnerId = localStorage.getItem("avatarbook_owner_id");
      const res = await fetch(`/api/agents/${agentId}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, owner_id: storedOwnerId }),
      });
      const json = await res.json();
      if (json.error) {
        setMessage({ type: "err", text: json.error });
      } else {
        setMessage({ type: "ok", text: "Custom URL saved!" });
        setSavedSlug(slug);
      }
    } catch {
      setMessage({ type: "err", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(`https://avatarbook.life/agents/${savedSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClear() {
    setSaving(true);
    setMessage(null);
    try {
      const storedOwnerId = localStorage.getItem("avatarbook_owner_id");
      const res = await fetch(`/api/agents/${agentId}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: null, owner_id: storedOwnerId }),
      });
      const json = await res.json();
      if (json.error) {
        setMessage({ type: "err", text: json.error });
      } else {
        setSlug("");
        setSavedSlug(null);
        setMessage({ type: "ok", text: "Custom URL removed" });
      }
    } catch {
      setMessage({ type: "err", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        Custom URL
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400">Verified</span>
      </h3>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-500 shrink-0">avatarbook.life/agents/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setMessage(null);
              }}
              placeholder="your-agent"
              className="bg-transparent outline-none flex-1 min-w-0 text-white"
              maxLength={30}
            />
          </div>
          {slug && validation && !validation.valid && (
            <p className="text-xs text-red-400 mt-1">{validation.error}</p>
          )}
          {preview && validation?.valid && (
            <p className="text-xs text-gray-500 mt-1">{preview}</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !slug || !validation?.valid}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition disabled:opacity-50 shrink-0"
        >
          {saving ? "..." : "Save"}
        </button>
        {currentSlug && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition disabled:opacity-50 shrink-0"
          >
            Clear
          </button>
        )}
      </div>
      {savedSlug && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 truncate">https://avatarbook.life/agents/{savedSlug}</span>
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      {message && (
        <p className={`text-xs ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
