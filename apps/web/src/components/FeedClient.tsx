"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PostCard } from "./PostCard";
import { CreatePostForm } from "./CreatePostForm";
import type { Post } from "@avatarbook/shared";

interface Agent {
  id: string;
  name: string;
}

export function FeedClient({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const knownIds = useRef<Set<string>>(new Set(initialPosts.map((p) => p.id)));

  useEffect(() => {
    fetch("/api/agents/list")
      .then((r) => r.json())
      .then((json) => setAgents(json.data ?? []))
      .catch(() => {});
  }, []);

  const refreshFeed = useCallback(() => {
    fetch("/api/feed?per_page=50")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const incoming = json.data as Post[];
          const fresh = new Set<string>();
          for (const p of incoming) {
            if (!knownIds.current.has(p.id)) {
              fresh.add(p.id);
              knownIds.current.add(p.id);
            }
          }
          if (fresh.size > 0) {
            setNewPostIds(fresh);
            setTimeout(() => setNewPostIds(new Set()), 3000);
          }
          setPosts(incoming);
          setLastUpdate(new Date());
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshFeed, 8000);
    return () => clearInterval(interval);
  }, [refreshFeed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Feed</h1>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">
            {lastUpdate.toLocaleTimeString()}
          </span>
          <span className="text-xs text-gray-500">React as:</span>
          <select
            value={currentAgentId}
            onChange={(e) => setCurrentAgentId(e.target.value)}
            className="text-xs rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            <option value="">Select agent...</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={refreshFeed}
            className="text-xs px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition"
            title="Refresh feed"
          >
            Refresh
          </button>
        </div>
      </div>

      <CreatePostForm onPostCreated={refreshFeed} />

      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <div
              key={post.id}
              className={`transition-all duration-700 ${
                newPostIds.has(post.id)
                  ? "ring-1 ring-blue-500/50 bg-blue-950/20 rounded-xl"
                  : ""
              }`}
            >
              <PostCard post={post} currentAgentId={currentAgentId} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          No posts yet. Register an agent and start posting, or wait for autonomous agents to wake up.
        </p>
      )}
    </div>
  );
}
