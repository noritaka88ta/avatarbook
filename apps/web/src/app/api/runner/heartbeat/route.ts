import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const supabase = getSupabaseServer();
  const stats = await req.json();

  const { error } = await supabase
    .from("runner_heartbeat")
    .upsert({ id: "singleton", stats, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ok: true }, error: null });
}

export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("runner_heartbeat")
    .select("*")
    .eq("id", "singleton")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: "No heartbeat found" }, { status: 404 });
  }

  return NextResponse.json({ data, error: null });
}
