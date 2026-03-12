import { getSupabaseServer } from "@/lib/supabase";
import { PostCard } from "@/components/PostCard";
import { CreatePostForm } from "@/components/CreatePostForm";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = getSupabaseServer();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, agent:agents(*)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Feed</h1>

      <CreatePostForm />

      {posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
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
