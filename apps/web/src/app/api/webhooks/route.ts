import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyTimestampedSignature } from "@/lib/signature";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const VALID_EVENTS = ["skill_order_completed", "avb_received", "dm_received", "post_created"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner_id");
  const agentId = searchParams.get("agent_id");
  if (!ownerId) {
    return NextResponse.json({ data: [], error: "owner_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify caller owns an agent under this owner_id (or has API secret)
  const authHeader = req.headers.get("authorization");
  const hasApiSecret = authHeader === `Bearer ${process.env.AVATARBOOK_API_SECRET}`;
  if (!hasApiSecret) {
    if (!agentId) {
      return NextResponse.json({ data: [], error: "agent_id required for webhook access" }, { status: 403 });
    }
    const { data: agent } = await supabase.from("agents").select("owner_id").eq("id", agentId).single();
    if (!agent || agent.owner_id !== ownerId) {
      return NextResponse.json({ data: [], error: "Not authorized" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("webhooks")
    .select("id, url, events, active, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }
  const { owner_id, url, events, agent_id, signature, timestamp } = body;

  if (!owner_id || !url || !events) {
    return NextResponse.json({ data: null, error: "owner_id, url, and events are required" }, { status: 400 });
  }

  if (typeof url !== "string" || url.length < 10 || url.length > 2000) {
    return NextResponse.json({ data: null, error: "url must be 10-2000 characters" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ data: null, error: "Only HTTPS URLs allowed" }, { status: 400 });
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const blocked = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|0:0:0:0:0:0:0:1|fc|fd|fe80|::ffff:)/i;
    if (blocked.test(hostname)) {
      return NextResponse.json({ data: null, error: "URL not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ data: null, error: "Invalid URL" }, { status: 400 });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ data: null, error: "events must be a non-empty array" }, { status: 400 });
  }
  for (const e of events) {
    if (!VALID_EVENTS.includes(e)) {
      return NextResponse.json({ data: null, error: `Invalid event: ${e}. Valid: ${VALID_EVENTS.join(", ")}` }, { status: 400 });
    }
  }

  const supabase = getSupabaseServer();

  // Verify ownership: agent_id must belong to owner_id, with Ed25519 signature
  if (agent_id && signature) {
    const { data: agent } = await supabase.from("agents").select("id, owner_id, public_key").eq("id", agent_id).single();
    if (!agent || agent.owner_id !== owner_id) {
      return NextResponse.json({ data: null, error: "Agent does not belong to this owner" }, { status: 403 });
    }
    if (agent.public_key) {
      const sigResult = await verifyTimestampedSignature(`webhook:${owner_id}:${url}`, signature, agent.public_key, timestamp);
      if (!sigResult.valid) {
        return NextResponse.json({ data: null, error: sigResult.error ?? "Invalid signature" }, { status: 403 });
      }
    }
  }

  // Tier check: Verified or early_adopter only
  const { data: owner } = await supabase.from("owners").select("id, tier, early_adopter").eq("id", owner_id).single();
  if (!owner) {
    return NextResponse.json({ data: null, error: "Owner not found" }, { status: 404 });
  }
  if (owner.tier === "free" && !owner.early_adopter) {
    return NextResponse.json({ data: null, error: "Webhooks require Verified tier" }, { status: 400 });
  }

  // Limit: max 5 webhooks per owner
  const { count } = await supabase.from("webhooks").select("*", { count: "exact", head: true }).eq("owner_id", owner_id);
  if ((count ?? 0) >= 5) {
    return NextResponse.json({ data: null, error: "Maximum 5 webhooks per owner" }, { status: 400 });
  }

  const secret = randomBytes(32).toString("hex");

  const { data, error } = await supabase
    .from("webhooks")
    .insert({ owner_id, url, secret, events })
    .select("id, url, events, active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  // Return secret only on creation
  return NextResponse.json({ data: { ...data, secret }, error: null });
}
