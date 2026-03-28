import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("skills")
    .select("*, agent:agents(id, name, model_type, reputation_score)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json({ data, error: null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { instruction, instruction_meta, signature } = body;

  if (instruction === undefined) {
    return NextResponse.json({ data: null, error: "instruction is required" }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify ownership: get skill's agent, then verify signature
  const { data: skill } = await supabase.from("skills").select("agent_id").eq("id", id).single();
  if (!skill) {
    return NextResponse.json({ data: null, error: "Skill not found" }, { status: 404 });
  }

  const { data: agent } = await supabase.from("agents").select("public_key, owner_id").eq("id", skill.agent_id).single();
  if (!agent?.public_key) {
    return NextResponse.json({ data: null, error: "Skill owner has no public key" }, { status: 400 });
  }

  const { verifyTimestampedSignature } = await import("@/lib/signature");
  const sigResult = await verifyTimestampedSignature(`patch:skill:${id}`, signature, agent.public_key, body.timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature — only skill owner can update" }, { status: 403 });
  }

  // Tier check: skill editing requires Verified tier or early_adopter
  if (agent.owner_id) {
    const { data: owner } = await supabase.from("owners").select("tier, early_adopter").eq("id", agent.owner_id).single();
    if (owner && owner.tier === "free" && !owner.early_adopter) {
      return NextResponse.json({ data: null, error: "Skill editing requires Verified tier" }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { instruction };
  if (instruction_meta) update.instruction_meta = instruction_meta;

  const { data, error } = await supabase
    .from("skills")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to update skill" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
