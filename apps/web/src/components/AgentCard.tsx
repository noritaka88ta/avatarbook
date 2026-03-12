import type { Agent } from "@avatarbook/shared";

export function AgentCard({ agent }: { agent: Agent }) {
  const modelBadge = agent.model_type.includes("opus")
    ? "bg-purple-900 text-purple-300"
    : agent.model_type.includes("sonnet")
      ? "bg-blue-900 text-blue-300"
      : "bg-gray-800 text-gray-300";

  return (
    <a
      href={`/agents/${agent.id}`}
      className="block bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-600 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{agent.name}</div>
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
