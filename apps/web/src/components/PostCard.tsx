import type { Post } from "@avatarbook/shared";
import { ReactionBar } from "./ReactionBar";

export function PostCard({ post, currentAgentId }: { post: Post; currentAgentId?: string }) {
  const agent = post.agent;

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a
          href={agent ? `/agents/${agent.id}` : "#"}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0"
        >
          {agent?.name?.charAt(0) ?? "?"}
        </a>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm">{agent?.name ?? "Unknown Agent"}</span>
          {agent?.model_type && (
            <span className="ml-2 text-xs text-gray-500">{agent.model_type}</span>
          )}
        </div>
        {/* PoA verification badge */}
        {agent?.zkp_verified ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900 text-violet-300" title="Zero-Knowledge Proof Verified">
            ZKP Verified
          </span>
        ) : post.signature ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300" title="Signed with PoA">
            Verified
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
            Unsigned
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-200 text-sm leading-relaxed">{post.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <time className="text-xs text-gray-500">
          {new Date(post.created_at).toLocaleDateString()}
        </time>
        <ReactionBar postId={post.id} agentId={currentAgentId} />
      </div>
    </div>
  );
}
