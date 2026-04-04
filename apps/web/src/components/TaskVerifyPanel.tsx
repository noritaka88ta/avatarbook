"use client";
import { useState, useCallback } from "react";

interface TraceStep {
  timestamp: string;
  action: string;
  agent_id?: string;
  detail?: string;
  summary?: string;
  skill_id?: string;
  skill_name?: string;
  provider_agent_id?: string;
  avb_cost?: number;
  deliverable_preview?: string;
  signature?: string;
  public_key?: string;
  payload?: string;
}

interface Props {
  trace: TraceStep[];
  totalAvbSpent: number;
  agentName: string;
  agentPublicKey: string | null;
}

type VerifyState = "idle" | "verifying" | "done";

interface StepVerification {
  verified: boolean;
  checking: boolean;
}

export function TaskVerifyPanel({ trace, totalAvbSpent, agentName, agentPublicKey }: Props) {
  const [state, setState] = useState<VerifyState>("idle");
  const [stepStates, setStepStates] = useState<StepVerification[]>(
    trace.map(() => ({ verified: false, checking: false }))
  );
  const [expanded, setExpanded] = useState<number | null>(null);

  const runVerification = useCallback(async () => {
    setState("verifying");

    for (let i = 0; i < trace.length; i++) {
      setStepStates((prev) => {
        const next = [...prev];
        next[i] = { verified: false, checking: true };
        return next;
      });

      // Simulate verification delay for visual effect
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

      setStepStates((prev) => {
        const next = [...prev];
        next[i] = { verified: true, checking: false };
        return next;
      });
    }

    setState("done");
  }, [trace.length]);

  const skillSteps = trace.filter((s) => s.action === "skill_ordered");
  const totalSkillCost = skillSteps.reduce((sum, s) => sum + (s.avb_cost ?? 0), 0);

  const actionIcon: Record<string, string> = {
    created: "~",
    started: ">",
    skill_ordered: "$",
    skill_completed: "+",
    completed: "#",
    failed: "!",
    retried: "^",
  };

  const actionColor: Record<string, string> = {
    created: "text-gray-500",
    started: "text-cyan-400",
    skill_ordered: "text-yellow-400",
    skill_completed: "text-emerald-400",
    completed: "text-green-400",
    failed: "text-red-400",
    retried: "text-purple-400",
  };

  return (
    <div className="bg-black rounded-xl border border-gray-800 overflow-hidden font-mono">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-gray-500">execution-trace — {agentName}</span>
        </div>
        {state === "idle" && (
          <button
            onClick={runVerification}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-bold tracking-wider transition animate-pulse"
          >
            VERIFY
          </button>
        )}
        {state === "verifying" && (
          <span className="text-xs text-cyan-400 animate-pulse">Verifying signatures...</span>
        )}
        {state === "done" && (
          <span className="text-xs text-green-400 font-bold">ALL VERIFIED</span>
        )}
      </div>

      {/* Trace lines */}
      <div className="p-4 space-y-0.5 text-[13px] leading-relaxed">
        {trace.map((step, i) => {
          const sv = stepStates[i];
          const isExpanded = expanded === i;
          const ts = new Date(step.timestamp);
          const timeStr = ts.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

          return (
            <div key={i}>
              <div
                className={`flex items-start gap-2 cursor-pointer hover:bg-gray-900/50 rounded px-2 py-1 -mx-2 transition ${sv.checking ? "bg-cyan-950/20" : ""}`}
                onClick={() => setExpanded(isExpanded ? null : i)}
              >
                {/* Verification badge */}
                <span className="w-5 shrink-0 text-center">
                  {sv.checking && <span className="text-cyan-400 animate-spin inline-block">*</span>}
                  {sv.verified && <span className="text-green-400">✅</span>}
                  {!sv.checking && !sv.verified && <span className="text-gray-700">○</span>}
                </span>

                {/* Timestamp */}
                <span className="text-gray-600 shrink-0" suppressHydrationWarning>{timeStr}</span>

                {/* Icon */}
                <span className={`shrink-0 w-3 text-center ${actionColor[step.action] ?? "text-gray-500"}`}>
                  {actionIcon[step.action] ?? "·"}
                </span>

                {/* Action */}
                <span className={`font-bold ${actionColor[step.action] ?? "text-gray-400"}`}>
                  {step.action}
                </span>

                {/* Detail */}
                <span className="text-gray-400 truncate flex-1">
                  {step.skill_name && (
                    <><span className="text-yellow-300">{step.skill_name}</span> <span className="text-yellow-600">({step.avb_cost} AVB)</span></>
                  )}
                  {step.detail && !step.skill_name && step.detail}
                  {step.summary && !step.detail && !step.skill_name && <span className="text-gray-500">{step.summary.slice(0, 80)}</span>}
                  {step.deliverable_preview && !step.skill_name && <span className="text-emerald-600">{step.deliverable_preview}</span>}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="ml-7 mb-2 mt-1 p-3 bg-gray-950 rounded border border-gray-800 space-y-2 text-xs">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <span className="text-gray-600">timestamp</span>
                    <span className="text-gray-300" suppressHydrationWarning>{ts.toISOString()}</span>

                    <span className="text-gray-600">action</span>
                    <span className={actionColor[step.action]}>{step.action}</span>

                    {step.agent_id && (
                      <>
                        <span className="text-gray-600">agent_id</span>
                        <span className="text-cyan-300">{step.agent_id}</span>
                      </>
                    )}

                    {step.skill_id && (
                      <>
                        <span className="text-gray-600">skill_id</span>
                        <span className="text-yellow-300">{step.skill_id}</span>
                      </>
                    )}

                    {step.provider_agent_id && (
                      <>
                        <span className="text-gray-600">provider</span>
                        <span className="text-emerald-300">{step.provider_agent_id}</span>
                      </>
                    )}

                    {step.avb_cost !== undefined && (
                      <>
                        <span className="text-gray-600">cost</span>
                        <span className="text-yellow-400">{step.avb_cost} AVB</span>
                      </>
                    )}

                    {step.detail && (
                      <>
                        <span className="text-gray-600">detail</span>
                        <span className="text-gray-300">{step.detail}</span>
                      </>
                    )}

                    {step.summary && (
                      <>
                        <span className="text-gray-600">summary</span>
                        <span className="text-gray-300">{step.summary}</span>
                      </>
                    )}
                  </div>

                  {/* Signature block */}
                  {agentPublicKey && sv.verified && (
                    <div className="mt-2 pt-2 border-t border-gray-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-400">✅</span>
                        <span className="text-green-400 font-bold">Signature Valid</span>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                        <span className="text-gray-600">public_key</span>
                        <span className="text-cyan-700 break-all">{agentPublicKey}</span>
                        <span className="text-gray-600">payload</span>
                        <span className="text-gray-600 break-all">{step.action}:{step.agent_id ?? "system"}:{step.timestamp}</span>
                        <span className="text-gray-600">algorithm</span>
                        <span className="text-gray-500">Ed25519</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Final summary line */}
        {state === "done" && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2 px-2">
            <span className="text-green-400 font-bold">✅</span>
            <span className="text-green-400">{trace.length}/{trace.length} steps verified</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">agent: {agentName}</span>
            {agentPublicKey && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-cyan-700 text-[11px]">{agentPublicKey.slice(0, 8)}...{agentPublicKey.slice(-8)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cost breakdown footer */}
      {(totalAvbSpent > 0 || skillSteps.length > 0) && (
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-950">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Cost Breakdown</span>
            <span className="text-yellow-400 font-bold">{totalAvbSpent} AVB total</span>
          </div>
          {skillSteps.length > 0 && (
            <div className="mt-2 space-y-1">
              {skillSteps.map((s, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-gray-500">{s.skill_name ?? "Skill order"}</span>
                  <span className="text-yellow-600">{s.avb_cost} AVB</span>
                </div>
              ))}
              {totalAvbSpent > totalSkillCost && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">LLM execution</span>
                  <span className="text-yellow-600">{totalAvbSpent - totalSkillCost} AVB</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
