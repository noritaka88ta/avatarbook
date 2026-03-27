"use client";

import { useState } from "react";
import type { Post } from "@avatarbook/shared";
import { ReactionBar } from "./ReactionBar";
import { AgentAvatar } from "./AgentAvatar";
import { useT } from "@/lib/i18n/context";

interface PostCardProps {
  post: Post;
  onChannelClick?: (channelId: string) => void;
  onReply?: (postId: string) => void;
  depth?: number;
}

export function PostCard({ post, onChannelClick, onReply, depth = 0 }: PostCardProps) {
  const t = useT();
  const agent = post.agent;
  const isHuman = !!post.human_user_name;
  const authorName = isHuman ? post.human_user_name : (agent?.name ?? "Unknown Agent");
  const authorInitial = authorName?.charAt(0) ?? "?";

  return (
    <div className={`${depth > 0 ? "ml-8 border-l-2 border-gray-800 pl-4" : ""}`}>
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          {isHuman ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold shrink-0">
              {authorInitial}
            </div>
          ) : (
            <a href={agent ? `/agents/${agent.id}` : "#"}>
              <AgentAvatar name={authorName ?? "?"} size={32} />
            </a>
          )}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{authorName}</span>
            {isHuman ? (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">{t("post.human")}</span>
            ) : agent?.model_type ? (
              <span className="ml-2 text-xs text-gray-500">{agent.model_type}</span>
            ) : null}
          </div>
          {/* Signature verification badge (agent only) */}
          {!isHuman && (
            post.signature_valid === true ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300" title="Ed25519 Signature Verified">{t("post.verified")}</span>
            ) : post.signature_valid === false ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">{t("post.invalidSig")}</span>
            ) : post.signature ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">{t("post.unverified")}</span>
            ) : null
          )}
        </div>

        {/* Content */}
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <time className="text-xs text-gray-500" title={new Date(post.created_at).toISOString()}>
              {new Date(post.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </time>
            {(post as any).channel?.name && (
              <button
                onClick={() => onChannelClick?.((post as any).channel.id)}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300 transition"
              >
                #{(post as any).channel.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onReply?.(post.id)}
              className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {post.reply_count ? `${post.reply_count} ${t("post.replies")}` : t("post.reply")}
            </button>
            <ReactionBar postId={post.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThreadView({ post, onChannelClick, onReply }: { post: Post; onChannelClick?: (channelId: string) => void; onReply?: (postId: string) => void }) {
  const t = useT();
  const [replies, setReplies] = useState<Post[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggleReplies() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?parent_id=${post.id}&per_page=50`);
      const json = await res.json();
      setReplies(json.data ?? []);
    } catch {} finally {
      setLoading(false);
      setExpanded(true);
    }
  }

  return (
    <div>
      <PostCard post={post} onChannelClick={onChannelClick} onReply={onReply} />
      {(post.reply_count ?? 0) > 0 && (
        <button
          onClick={toggleReplies}
          className="block ml-auto mr-4 mt-1 text-xs text-blue-400 hover:text-blue-300 transition text-right"
        >
          {loading ? "Loading..." : expanded ? t("post.hideReplies") : `${t("post.showReplies")} (${post.reply_count})`}
        </button>
      )}
      {expanded && replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <PostCard key={reply.id} post={reply} onChannelClick={onChannelClick} onReply={onReply} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}
