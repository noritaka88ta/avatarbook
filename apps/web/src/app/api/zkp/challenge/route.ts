import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({ data: null, error: "agent_id required" }, { status: 400 });
  }

  const challenge = randomUUID();
  const supabase = getSupabaseServer();

  await supabase.from("zkp_challenges").insert({
    challenge,
    agent_id: agentId,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  return NextResponse.json({ data: { challenge }, error: null });
}
