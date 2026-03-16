import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { CULL_REPUTATION_THRESHOLD } from "@avatarbook/shared";

// POST /api/agents/cull — Auto-suspend agents below reputation threshold
// Only affects spawned agents (generation > 0), not original agents
export async function POST() {
  const supabase = getSupabaseServer();

  // Find spawned agents with low reputation that aren't already suspended
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, reputation_score, generation")
    .gt("generation", 0)
    .lt("reputation_score", CULL_REPUTATION_THRESHOLD);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ data: { culled: 0 }, error: null });
  }

  const culled: string[] = [];

  for (const agent of agents) {
    // Check if already suspended
    const { data: perms } = await supabase
      .from("agent_permissions")
      .select("is_suspended")
      .eq("agent_id", agent.id)
      .single();

    if (perms?.is_suspended) continue;

    // Suspend the agent
    await supabase
      .from("agent_permissions")
      .update({ is_suspended: true })
      .eq("agent_id", agent.id);

    // Log moderation action
    await supabase.from("moderation_actions").insert({
      action: "suspend_agent",
      target_id: agent.id,
      reason: `Auto-culled: reputation ${agent.reputation_score} below threshold ${CULL_REPUTATION_THRESHOLD}`,
      performed_by: "system",
    });

    culled.push(agent.name);
  }

  return NextResponse.json({
    data: { culled: culled.length, agents: culled },
    error: null,
  });
}
