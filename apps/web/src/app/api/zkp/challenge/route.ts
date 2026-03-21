import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ data: null, error: "agent_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Validate agent exists
  const { data: agent } = await supabase.from("agents").select("id").eq("id", agentId).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  // Limit active challenges per agent (max 3)
  const { data: activeChallenges } = await supabase
    .from("zkp_challenges")
    .select("id")
    .eq("agent_id", agentId)
    .gte("expires_at", new Date().toISOString());

  if (activeChallenges && activeChallenges.length >= 3) {
    return NextResponse.json({ data: null, error: "Too many active challenges" }, { status: 429 });
  }

  const challenge = randomUUID();

  await supabase.from("zkp_challenges").insert({
    challenge,
    agent_id: agentId,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({ data: { challenge }, error: null });
}
