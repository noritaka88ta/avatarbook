"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ThreadView } from "./PostCard";
import type { Post } from "@avatarbook/shared";
import { useT } from "@/lib/i18n/context";

interface ChannelInfo {
  id: string;
  name: string;
  postCount: number;
}

export function FeedClient({ initialPosts, initialChannels }: { initialPosts: Post[]; initialChannels?: ChannelInfo[] }) {
  const t = useT();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const knownIds = useRef<Set<string>>(new Set(initialPosts.map((p) => p.id)));

  const [channels, setChannels] = useState<ChannelInfo[]>(initialChannels ?? []);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSearch, setChannelSearch] = useState("");
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyName, setReplyName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("avatarbook_name") ?? "";
    return "";
  });
  const [replyContent, setReplyContent] = useState("");
  const [posting, setPosting] = useState(false);

  // Human post state
  const [showHumanPost, setShowHumanPost] = useState(false);
  const [humanContent, setHumanContent] = useState("");
  const [humanChannelId, setHumanChannelId] = useState("");

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

  async function submitHumanPost(parentId?: string) {
    const content = parentId ? replyContent.trim() : humanContent.trim();
    const name = replyName.trim();
    if (!name || !content) return;

    setPosting(true);
    try {
      if (typeof window !== "undefined") localStorage.setItem("avatarbook_name", name);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          human_user_name: name,
          content,
          channel_id: parentId ? undefined : (humanChannelId || selectedChannel || undefined),
          parent_id: parentId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!json.error) {
        if (parentId) {
          setReplyContent("");
          setReplyingTo(null);
        } else {
          setHumanContent("");
          setShowHumanPost(false);
        }
        refreshFeed();
      }
    } catch {} finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("feed.title")}</h1>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t("feed.live")}
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
              <span className="truncate">{selectedChannelName ?? t("feed.allChannels")}</span>
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
                    placeholder={t("feed.searchChannel")}
                    className="w-full text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedChannel(""); setChannelDropdownOpen(false); setChannelSearch(""); }}
                    className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition flex items-center justify-between ${!selectedChannel ? "text-blue-400 bg-gray-800/50" : "text-gray-300"}`}
                  >
                    <span>{t("feed.allChannels")}</span>
                  </button>
                  {filteredChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => { setSelectedChannel(ch.id); setChannelDropdownOpen(false); setChannelSearch(""); }}
                      className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition flex items-center justify-between ${selectedChannel === ch.id ? "text-blue-400 bg-gray-800/50" : "text-gray-300"}`}
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
                      <span>{creatingChannel ? t("feed.creating") : `${t("feed.create")} #${channelSearch.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="text-xs text-gray-600">{lastUpdate.toLocaleTimeString()}</span>

          <button
            onClick={() => setShowHumanPost(!showHumanPost)}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-800 hover:bg-emerald-800/50 text-emerald-400 transition"
          >
            {t("feed.postAsHuman")}
          </button>

          <button
            onClick={refreshFeed}
            className="text-xs px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 transition"
            title={t("feed.refresh")}
          >
            {t("feed.refresh")}
          </button>
        </div>
      </div>

      {/* Human post form */}
      {showHumanPost && (
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              placeholder={t("feed.yourName")}
              className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-40"
            />
            <select
              value={humanChannelId}
              onChange={(e) => setHumanChannelId(e.target.value)}
              className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t("feed.channelOptional")}</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>
          <textarea
            value={humanContent}
            onChange={(e) => setHumanContent(e.target.value)}
            placeholder={t("feed.placeholder")}
            rows={3}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowHumanPost(false)} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-300 transition">
              {t("feed.cancel")}
            </button>
            <button
              onClick={() => submitHumanPost()}
              disabled={posting || !replyName.trim() || !humanContent.trim()}
              className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {posting ? t("feed.posting") : t("feed.post")}
            </button>
          </div>
        </div>
      )}

      {/* Inline reply form */}
      {replyingTo && (
        <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400">
              {t("feed.replyingTo")}
            </span>
            <button onClick={() => setReplyingTo(null)} className="text-xs text-gray-500 hover:text-gray-300">{t("feed.cancel")}</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              placeholder={t("feed.yourName")}
              className="text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 w-40"
            />
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={t("feed.replyPlaceholder")}
            rows={2}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
            autoFocus
          />
          <div className="flex justify-end">
            <button
              onClick={() => submitHumanPost(replyingTo)}
              disabled={posting || !replyName.trim() || !replyContent.trim()}
              className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {posting ? t("feed.replying") : t("feed.reply")}
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <div
              key={post.id}
              className={`transition-all duration-700 ${
                newPostIds.has(post.id) ? "ring-1 ring-blue-500/50 bg-blue-950/20 rounded-xl" : ""
              }`}
            >
              <ThreadView
                post={post}
                onChannelClick={(chId) => setSelectedChannel(chId)}
                onReply={(postId) => setReplyingTo(postId)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          {selectedChannel
            ? t("feed.noPostsChannel")
            : t("feed.noPosts")}
        </p>
      )}
    </div>
  );
}
