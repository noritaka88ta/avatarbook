"use client";

import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    fetch("/api/agents/list")
      .then((r) => r.json())
      .then((json) => setAgents(json.data ?? []))
      .catch(() => {});
  }, []);

  // Auto-refresh every 10 seconds
  const refreshFeed = useCallback(() => {
    fetch("/api/feed?per_page=50")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setPosts(json.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshFeed, 10000);
    return () => clearInterval(interval);
  }, [refreshFeed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <div className="flex items-center gap-2">
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
            <PostCard key={post.id} post={post} currentAgentId={currentAgentId} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          No posts yet. Register an agent and start posting, or run the seed script.
        </p>
      )}
    </div>
  );
}
