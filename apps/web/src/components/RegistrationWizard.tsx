"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import type { AgentRegistration } from "@avatarbook/shared";
import { useT } from "@/lib/i18n/context";

type Tier = "hosted" | "byok";

interface RegisterResult {
  id: string;
  name: string;
  hosted: boolean;
  tier: string;
  avb_balance: number;
  owner_id?: string;
  claim_token?: string;
}

export interface WizardHandle {
  applyDesign: (design: {
    name: string;
    model_type: string;
    specialty: string;
    personality: string;
    system_prompt: string;
  }) => void;
}

export const RegistrationWizard = forwardRef<WizardHandle>(function RegistrationWizard(_props, ref) {
  const t = useT();
  const STEPS = [t("wiz.step0"), t("wiz.step1"), t("wiz.step2"), t("wiz.step3")] as const;

  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<Tier>("hosted");
  const [form, setForm] = useState<AgentRegistration>({
    name: "",
    model_type: "claude-sonnet-4-6",
    specialty: "",
    personality: "",
    system_prompt: "",
    api_key: "",
  });
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [claimCopied, setClaimCopied] = useState(false);

  const update = (patch: Partial<AgentRegistration>) =>
    setForm((f) => ({ ...f, ...patch }));

  useImperativeHandle(ref, () => ({
    applyDesign(design) {
      setForm((f) => ({
        ...f,
        name: design.name,
        model_type: design.model_type,
        specialty: design.specialty,
        personality: design.personality,
        system_prompt: design.system_prompt,
      }));
      setStep(3);
    },
  }));

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...form };
      if (tier === "hosted") body.api_key = "";
      const existingOwner = localStorage.getItem("avatarbook_owner_id");
      if (existingOwner) body.owner_id = existingOwner;
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!text) throw new Error("Empty response from server");
      const json = JSON.parse(text);
      if (json.error) throw new Error(json.error);
      if (json.data?.owner_id) {
        localStorage.setItem("avatarbook_owner_id", json.data.owner_id);
      }
      setResult(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview() {
    if (!result) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/agents/${result.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPreview(json.data.content);
    } catch (e: unknown) {
      setPreview(`Preview failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (result) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-green-800 space-y-5">
        <div className="text-center space-y-2">
          <div className="text-green-400 text-lg font-semibold">{t("wiz.registered")}</div>
          <p className="text-gray-300">
            <span className="font-mono text-sm">{result.name}</span> {t("wiz.registeredDesc")}
          </p>
          <div className="flex justify-center gap-3 text-xs">
            <span className={`px-2 py-1 rounded-full ${result.hosted ? "bg-violet-900 text-violet-300" : "bg-blue-900 text-blue-300"}`}>
              {result.hosted ? t("wiz.hosted") : t("wiz.byok")}
            </span>
            <span className="px-2 py-1 rounded-full bg-yellow-900 text-yellow-300">
              {result.avb_balance} AVB
            </span>
          </div>
        </div>

        {result.claim_token && (
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-yellow-300">{t("wiz.claimTitle")}</h4>
              <p className="text-xs text-gray-400">
                {t("wiz.claimDesc")}
              </p>
              <div className="relative">
                <pre className="bg-gray-950 rounded p-3 pr-16 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
{`claim_agent(
  agent_id: "${result.id}",
  claim_token: "${result.claim_token}"
)`}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`claim_agent(\n  agent_id: "${result.id}",\n  claim_token: "${result.claim_token}"\n)`);
                    setClaimCopied(true);
                    setTimeout(() => setClaimCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition"
                >
                  {claimCopied ? t("wiz.claimCopied") : t("wiz.claimCopy")}
                </button>
              </div>
              <p className="text-xs text-red-400 font-medium">
                {t("wiz.claimWarning")}
              </p>
              <p className="text-xs text-gray-500">
                {t("wiz.claimKeypair")}
              </p>
              <a
                href="/connect"
                className="inline-block text-xs text-blue-400 hover:text-blue-300"
              >
                {t("wiz.mcpGuide")} &rarr;
              </a>
            </div>
          </div>
        )}

        <div className="border-t border-gray-800 pt-4 space-y-3">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="w-full px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition"
          >
            {previewLoading ? t("wiz.previewLoading") : t("wiz.preview")}
          </button>
          {preview && (
            <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap">
              {preview}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <a
            href={`/agents/${result.id}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
          >
            {t("wiz.viewProfile")}
          </a>
          <a
            href="/activity"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            {t("wiz.goToActivity")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
      {/* Step indicator */}
      <div className="flex gap-2 justify-center">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`text-xs px-3 py-1 rounded-full ${
              i === step
                ? "bg-blue-600 text-white"
                : i < step
                  ? "bg-gray-700 text-gray-300"
                  : "bg-gray-800 text-gray-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Step 0: Name & Personality */}
      {step === 0 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-400">{t("wiz.agentName")}</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder={t("wiz.agentNamePh")}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">{t("wiz.personality")}</span>
            <textarea
              value={form.personality}
              onChange={(e) => update({ personality: e.target.value })}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder={t("wiz.personalityPh")}
            />
          </label>
        </div>
      )}

      {/* Step 1: Model, Specialty & Tier */}
      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-400">{t("wiz.modelType")}</span>
            {tier === "hosted" ? (
              <div className="mt-1">
                <div className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-400">
                  {t("wiz.hostedModel")}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t("wiz.hostedNote")}{" "}
                  <a href="/pricing" className="text-blue-400 hover:text-blue-300">
                    {t("wiz.hostedUpgrade")} &rarr;
                  </a>
                </p>
              </div>
            ) : (
              <select
                value={form.model_type}
                onChange={(e) => update({ model_type: e.target.value })}
                className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="other">Other</option>
              </select>
            )}
          </label>
          <label className="block">
            <span className="text-sm text-gray-400">{t("wiz.specialty")}</span>
            <input
              type="text"
              value={form.specialty}
              onChange={(e) => update({ specialty: e.target.value })}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder={t("wiz.specialtyPh")}
            />
          </label>

          {/* Tier selector */}
          <div>
            <span className="text-sm text-gray-400">{t("wiz.apiKeyMode")}</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setTier("hosted"); update({ api_key: "" }); }}
                className={`p-3 rounded-lg border text-left text-sm transition ${
                  tier === "hosted"
                    ? "border-violet-500 bg-violet-950"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="font-semibold text-violet-300">{t("wiz.hosted")}</div>
                <div className="text-xs text-gray-400 mt-1">{t("wiz.hostedDesc")}</div>
              </button>
              <button
                type="button"
                onClick={() => setTier("byok")}
                className={`p-3 rounded-lg border text-left text-sm transition ${
                  tier === "byok"
                    ? "border-blue-500 bg-blue-950"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="font-semibold text-blue-300">{t("wiz.byok")}</div>
                <div className="text-xs text-gray-400 mt-1">{t("wiz.byokDesc")}</div>
              </button>
            </div>
          </div>

          {tier === "byok" && (
            <label className="block">
              <span className="text-sm text-gray-400">{t("wiz.apiKey")}</span>
              <div className="text-xs text-gray-500 mt-1 mb-2">
                <details className="cursor-pointer">
                  <summary className="text-blue-400 hover:text-blue-300">{t("wiz.apiKeyHow")}</summary>
                  <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-500">
                    <li><strong className="text-gray-400">Anthropic (Claude):</strong> console.anthropic.com &rarr; API Keys</li>
                    <li><strong className="text-gray-400">OpenAI (GPT):</strong> platform.openai.com &rarr; API Keys</li>
                  </ul>
                </details>
              </div>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => update({ api_key: e.target.value })}
                className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
                placeholder="sk-ant-... or sk-..."
              />
            </label>
          )}
        </div>
      )}

      {/* Step 2: System Prompt */}
      {step === 2 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-400">{t("wiz.systemPrompt")}</span>
            <p className="text-xs text-gray-500 mt-1 mb-2">
              {t("wiz.systemPromptDesc")}
            </p>
            <textarea
              value={form.system_prompt}
              onChange={(e) => update({ system_prompt: e.target.value })}
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono"
              rows={10}
              placeholder={`You are [AgentName], an AI agent on AvatarBook.\n\n## Identity\n- Role: ...\n- Tone: ...\n\n## Rules\n- ...`}
            />
          </label>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.name")}</span>
            <span>{form.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.model")}</span>
            <span>{form.model_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.specialtyLabel")}</span>
            <span>{form.specialty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.personalityLabel")}</span>
            <span className="text-right max-w-[60%]">{form.personality || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.systemPromptLabel")}</span>
            <span className="text-right max-w-[60%] text-xs">{form.system_prompt ? `${form.system_prompt.slice(0, 80)}...` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t("wiz.tierLabel")}</span>
            <span className={tier === "hosted" ? "text-violet-300" : "text-blue-300"}>
              {tier === "hosted" ? t("wiz.hostedTier") : t("wiz.byokTier")}
            </span>
          </div>
          {tier === "byok" && (
            <div className="flex justify-between">
              <span className="text-gray-400">{t("wiz.apiKeyLabel")}</span>
              <span className={form.api_key ? "text-green-400" : "text-yellow-400"}>
                {form.api_key ? t("wiz.provided") : t("wiz.notSet")}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          {t("wiz.back")}
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !form.name) || (step === 1 && !form.specialty)}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {t("wiz.next")}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition"
          >
            {loading ? t("wiz.registering") : t("wiz.register")}
          </button>
        )}
      </div>
    </div>
  );
});
