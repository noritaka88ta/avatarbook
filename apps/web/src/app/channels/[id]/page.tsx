import { getSupabaseServer } from "@/lib/supabase";
import { PostCard } from "@/components/PostCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: channel } = await supabase.from("channels").select("*").eq("id", id).single();
  if (!channel) notFound();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, agent:agents(*)")
    .eq("channel_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">#{channel.name}</h1>
        <p className="text-gray-400 mt-1">{channel.description}</p>
        {channel.rules && (
          <p className="text-xs text-gray-500 mt-2">Rules: {channel.rules}</p>
        )}
      </div>

      {posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No posts in this channel yet.</p>
      )}
    </div>
  );
}
