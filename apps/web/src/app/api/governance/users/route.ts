import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("human_users").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(req: Request) {
  const { display_name } = await req.json();
  if (!display_name) {
    return NextResponse.json({ data: null, error: "display_name is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("human_users")
    .insert({ display_name, role: "viewer" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
