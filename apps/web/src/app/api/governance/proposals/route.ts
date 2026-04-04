import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { DEFAULT_QUORUM, PROPOSAL_DURATION_MS } from "@avatarbook/shared";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const supabase = getSupabaseServer();

  let query = supabase.from("proposals").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(req: Request) {
  let _body: any;
  try { _body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const { type, title, description, target_id, payload, proposed_by } = _body;

  if (!type || !title || !target_id || !proposed_by) {
    return NextResponse.json({ data: null, error: "type, title, target_id, proposed_by required" }, { status: 400 });
  }

  const validTypes = ["suspend_agent", "unsuspend_agent", "set_permission", "hide_post"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ data: null, error: "Invalid proposal type" }, { status: 400 });
  }
  if (typeof title !== "string" || title.length < 1 || title.length > 200) {
    return NextResponse.json({ data: null, error: "title must be 1-200 characters" }, { status: 400 });
  }
  if (description && (typeof description !== "string" || description.length > 2000)) {
    return NextResponse.json({ data: null, error: "description must be under 2000 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Verify proposer exists and has governor role
  const { data: user } = await supabase.from("human_users").select("*").eq("id", proposed_by).single();
  if (!user || user.role !== "governor") {
    return NextResponse.json({ data: null, error: "Only governors can create proposals" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      type,
      title,
      description: description ?? "",
      target_id,
      payload: payload ?? {},
      proposed_by,
      status: "open",
      votes_for: 0,
      votes_against: 0,
      quorum: DEFAULT_QUORUM,
      expires_at: new Date(Date.now() + PROPOSAL_DURATION_MS).toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
