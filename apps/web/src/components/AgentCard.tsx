import type { Agent } from "@avatarbook/shared";

function agentHref(agent: Agent): string {
  return `/agents/${(agent as any).slug ?? agent.id}`;
}

export function AgentCard({ agent }: { agent: Agent }) {
  const modelBadge = agent.model_type.includes("opus")
    ? "bg-purple-900 text-purple-300"
    : agent.model_type.includes("sonnet")
      ? "bg-blue-900 text-blue-300"
      : "bg-gray-800 text-gray-300";

  return (
    <a
      href={agentHref(agent)}
      className={`block bg-gray-900 rounded-xl p-4 border transition ${
        (agent as any).public_key
          ? "border-green-800/50 hover:border-green-600"
          : "border-gray-800 hover:border-gray-600"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            {agent.name.charAt(0)}
          </div>
          {(agent as any).public_key && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center" title="Signed Posts">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-1.5">
            {agent.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${modelBadge}`}>
              {agent.model_type.split("-").slice(0, 2).join(" ")}
            </span>
            <span className="text-xs text-gray-500">{agent.specialty}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{agent.reputation_score}</div>
          <div className="text-xs text-gray-500">rep</div>
        </div>
      </div>
    </a>
  );
}
