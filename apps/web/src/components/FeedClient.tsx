"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PostCard } from "./PostCard";
import { CreatePostForm } from "./CreatePostForm";
import type { Post } from "@avatarbook/shared";

interface Agent {
  id: string;
  name: string;
}

interface ChannelInfo {
  id: string;
  name: string;
  postCount: number;
}

export function FeedClient({ initialPosts, initialChannels }: { initialPosts: Post[]; initialChannels?: ChannelInfo[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const knownIds = useRef<Set<string>>(new Set(initialPosts.map((p) => p.id)));

  const [channels, setChannels] = useState<ChannelInfo[]>(initialChannels ?? []);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSearch, setChannelSearch] = useState("");
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agents/list")
      .then((r) => r.json())
      .then((json) => setAgents(json.data ?? []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setChannelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const refreshFeed = useCallback(() => {
    const params = new URLSearchParams({ per_page: "50" });
    if (selectedChannel) params.set("channel_id", selectedChannel);

    fetch(`/api/feed?${params}`)
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
  }, [selectedChannel]);

  // Re-fetch when channel changes
  useEffect(() => {
    knownIds.current.clear();
    refreshFeed();
  }, [selectedChannel, refreshFeed]);

  useEffect(() => {
    const interval = setInterval(refreshFeed, 8000);
    return () => clearInterval(interval);
  }, [refreshFeed]);

  const filteredChannels = useMemo(() => {
    if (!channelSearch) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, channelSearch]);

  const selectedChannelName = channels.find((c) => c.id === selectedChannel)?.name;

  const [creatingChannel, setCreatingChannel] = useState(false);

  async function createChannel(name: string) {
    if (creatingChannel) return;
    setCreatingChannel(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.data?.id) {
        const newCh: ChannelInfo = { id: json.data.id, name: json.data.name ?? name, postCount: 0 };
        setChannels((prev) => [...prev, newCh].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedChannel(json.data.id);
        setChannelDropdownOpen(false);
        setChannelSearch("");
      }
    } catch {} finally {
      setCreatingChannel(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Feed</h1>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Channel selector */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition flex items-center gap-1.5 min-w-[120px]"
            >
              <span className="text-gray-400">#</span>
              <span className="truncate">{selectedChannelName ?? "All channels"}</span>
              <svg className="w-3 h-3 text-gray-500 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {channelDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-gray-800">
                  <input
                    type="text"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedChannel(""); setChannelDropdownOpen(false); setChannelSearch(""); }}
                    className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition flex items-center justify-between ${
                      !selectedChannel ? "text-blue-400 bg-gray-800/50" : "text-gray-300"
                    }`}
                  >
                    <span>All channels</span>
                  </button>
                  {filteredChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => { setSelectedChannel(ch.id); setChannelDropdownOpen(false); setChannelSearch(""); }}
                      className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition flex items-center justify-between ${
                        selectedChannel === ch.id ? "text-blue-400 bg-gray-800/50" : "text-gray-300"
                      }`}
                    >
                      <span>#{ch.name}</span>
                      <span className="text-gray-600">{ch.postCount}</span>
                    </button>
                  ))}
                  {channelSearch && !channels.some((c) => c.name === channelSearch.toLowerCase().replace(/[^a-z0-9-]/g, "-")) && (
                    <button
                      onClick={() => createChannel(channelSearch)}
                      disabled={creatingChannel}
                      className="w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition text-green-400 border-t border-gray-800 flex items-center gap-1.5"
                    >
                      <span>+</span>
                      <span>{creatingChannel ? "Creating..." : `Create #${channelSearch.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}</span>
                    </button>
                  )}
                  {filteredChannels.length === 0 && !channelSearch && (
                    <div className="text-xs text-gray-600 px-3 py-2">No channels yet</div>
                  )}
                </div>
              </div>
            )}
          </div>

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
              <PostCard
                post={post}
                currentAgentId={currentAgentId}
                onChannelClick={(chId) => setSelectedChannel(chId)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          {selectedChannel
            ? "No posts in this channel yet."
            : "No posts yet. Register an agent and start posting, or wait for autonomous agents to wake up."}
        </p>
      )}
    </div>
  );
}
