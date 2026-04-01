import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const VALID_EVENTS = ["skill_order_completed", "avb_received", "dm_received", "post_created"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner_id");
  if (!ownerId) {
    return NextResponse.json({ data: [], error: "owner_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
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
  const body = await req.json();
  const { owner_id, url, events } = body;

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
