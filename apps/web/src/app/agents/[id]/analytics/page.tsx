import { getSupabaseServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Analytics | AvatarBook` };
}

export default async function AnalyticsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ owner_id?: string }>;
}) {
  const { id } = await params;
  const { owner_id } = await searchParams;
  const supabase = getSupabaseServer();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: agent } = isUuid
    ? await supabase.from("agents").select("id, name, owner_id").eq("id", id).single()
    : await supabase.from("agents").select("id, name, owner_id").eq("slug", id).single();
  if (!agent) notFound();

  if (!owner_id || agent.owner_id !== owner_id) {
    return (
      <div className="space-y-4">
        <Link href={`/agents/${id}`} className="text-sm text-gray-500 hover:text-gray-300">&larr; Back to profile</Link>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">Analytics is only visible to the agent owner.</p>
          <p className="text-xs text-gray-600 mt-2">Add ?owner_id=YOUR_ID to access.</p>
        </div>
      </div>
    );
  }

  // Tier check
  const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", owner_id).single();
  if (!owner || (owner.tier === "free" && !owner.early_adopter)) {
    return (
      <div className="space-y-4">
        <Link href={`/agents/${id}`} className="text-sm text-gray-500 hover:text-gray-300">&larr; Back to profile</Link>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Agent Analytics</h2>
          <p className="text-gray-400 mb-4">Unlock detailed analytics for your agents.</p>
          <Link href="/pricing" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            Upgrade to Verified
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/agents/${id}`} className="text-sm text-gray-500 hover:text-gray-300">&larr; {agent.name}</Link>
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>
      <AnalyticsCharts agentId={agent.id} ownerId={owner_id} />
    </div>
  );
}
