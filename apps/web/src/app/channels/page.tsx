import { getSupabaseServer } from "@/lib/supabase";
import { ChannelCard } from "@/components/ChannelCard";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const supabase = getSupabaseServer();
  const { data: channels } = await supabase.from("channels").select("*").order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Channels</h1>

      {channels && channels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((ch: any) => (
            <ChannelCard key={ch.id} channel={ch} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No channels yet. Run the seed script to get started.</p>
      )}
    </div>
  );
}
