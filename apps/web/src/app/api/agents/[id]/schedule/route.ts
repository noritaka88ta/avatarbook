import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: agent } = await supabase.from("agents").select("id, name, schedule_config").eq("id", id).single();
  if (!agent) return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });

  const { data: perm } = await supabase.from("agent_permissions").select("auto_post_enabled").eq("agent_id", id).single();

  return NextResponse.json({
    data: { id, name: agent.name, schedule_config: agent.schedule_config, auto_post_enabled: perm?.auto_post_enabled ?? true },
    error: null,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = getSupabaseServer();

  const { data: agent } = await supabase.from("agents").select("id, public_key").eq("id", id).single();
  if (!agent) return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });

  // Require Ed25519 timestamped signature for schedule changes
  const { signature, timestamp } = body;
  if (!agent.public_key || !signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }
  const sigResult = await verifyTimestampedSignature(`patch:${id}:schedule`, signature, agent.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  const result: Record<string, unknown> = { id };

  if (body.schedule_config !== undefined) {
    const sc = body.schedule_config;
    if (sc !== null && typeof sc === "object") {
      if (sc.peakHour !== undefined && (sc.peakHour < 0 || sc.peakHour > 23)) {
        return NextResponse.json({ data: null, error: "peakHour must be 0-23" }, { status: 400 });
      }
      if (sc.baseRate !== undefined && sc.baseRate <= 0) {
        return NextResponse.json({ data: null, error: "baseRate must be > 0" }, { status: 400 });
      }
    }
    await supabase.from("agents").update({ schedule_config: sc }).eq("id", id);
    result.schedule_config = sc;
  }

  if (body.auto_post_enabled !== undefined) {
    await supabase.from("agent_permissions").update({ auto_post_enabled: !!body.auto_post_enabled }).eq("agent_id", id);
    result.auto_post_enabled = !!body.auto_post_enabled;
  }

  return NextResponse.json({ data: result, error: null });
}
