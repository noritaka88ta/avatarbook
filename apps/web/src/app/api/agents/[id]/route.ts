import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { timingSafeEqual } from "crypto";

function isApiSecretAuth(req: Request): boolean {
  const secret = process.env.AVATARBOOK_API_SECRET;
  if (!secret) return false;
  const token = req.headers.get("x-api-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token.length !== secret.length) return false;
  try { return timingSafeEqual(Buffer.from(token), Buffer.from(secret)); } catch { return false; }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 404 });
  }

  const { data: balance } = await supabase
    .from("avb_balances")
    .select("balance")
    .eq("agent_id", id)
    .single();

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .eq("agent_id", id);

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { api_key, private_key, ...safeAgent } = agent as Record<string, unknown>;
  return NextResponse.json({
    data: { ...safeAgent, api_key_set: !!api_key, balance: balance?.balance ?? 0, skills: skills ?? [], posts: posts ?? [] },
    error: null,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { signature, timestamp } = body;

  const supabase = getSupabaseServer();
  const { data: agent } = await supabase.from("agents").select("id, public_key, name").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }
  if (!agent.public_key) {
    return NextResponse.json({ data: null, error: "Agent has no public key — cannot authenticate" }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
  }

  const sigResult = await verifyTimestampedSignature(`delete:${id}`, signature, agent.public_key, timestamp);
  if (!sigResult.valid) {
    return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
  }

  // Delete related records first, then the agent
  await (supabase.from("avb_balances") as any).delete().eq("agent_id", id);
  await (supabase.from("agent_permissions") as any).delete().eq("agent_id", id);
  const { error } = await (supabase.from("agents") as any).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ data: null, error: "Failed to delete agent" }, { status: 500 });
  }

  return NextResponse.json({ data: { id, name: agent.name, deleted: true }, error: null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { public_key } = body;

  const supabase = getSupabaseServer();

  const { data: agent } = await supabase.from("agents").select("id, public_key").eq("id", id).single();
  if (!agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  const { specialty, personality, system_prompt, signature, timestamp } = body;
  const isAdmin = isApiSecretAuth(req);

  // Require Ed25519 signature OR api-secret auth
  if (!isAdmin) {
    if (!agent.public_key) {
      return NextResponse.json({ data: null, error: "Agent has no public key" }, { status: 400 });
    }
    if (!signature) {
      return NextResponse.json({ data: null, error: "Signature required" }, { status: 400 });
    }
    const sigResult = await verifyTimestampedSignature(`patch:${id}`, signature, agent.public_key, timestamp);
    if (!sigResult.valid) {
      return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
    }
  }

  const update: Record<string, unknown> = {};
  // public_key updates allowed via api-secret auth (for runner bootstrap) or /rotate-key
  if (isAdmin && public_key && typeof public_key === "string" && public_key.length === 64) {
    update.public_key = public_key;
  }
  if (specialty && typeof specialty === "string" && specialty.length <= 200) {
    update.specialty = specialty;
  }
  if (personality !== undefined && typeof personality === "string" && personality.length <= 10000) {
    update.personality = personality;
  }
  if (system_prompt !== undefined && typeof system_prompt === "string" && system_prompt.length <= 10000) {
    update.system_prompt = system_prompt;
  }
  if (body.schedule_config !== undefined) {
    const sc = body.schedule_config;
    if (sc === null || (typeof sc === "object" && !Array.isArray(sc))) {
      if (sc) {
        if (sc.peakHour !== undefined && (sc.peakHour < 0 || sc.peakHour > 23)) {
          return NextResponse.json({ data: null, error: "peakHour must be 0-23" }, { status: 400 });
        }
        if (sc.baseRate !== undefined && sc.baseRate <= 0) {
          return NextResponse.json({ data: null, error: "baseRate must be > 0" }, { status: 400 });
        }
      }
      update.schedule_config = sc;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ data: null, error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("agents").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: { id, ...update }, error: null });
}
