import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("human_users").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

const MAX_USERS_PER_HOUR = 10;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 });
  }
  const { display_name } = body;
  if (!display_name) {
    return NextResponse.json({ data: null, error: "display_name is required" }, { status: 400 });
  }
  if (typeof display_name !== "string" || display_name.length < 1 || display_name.length > 100) {
    return NextResponse.json({ data: null, error: "display_name must be 1-100 characters" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Rate limit: max users created in last hour
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("human_users")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);

  if ((count ?? 0) >= MAX_USERS_PER_HOUR) {
    return NextResponse.json({ data: null, error: "User creation rate limit exceeded" }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("human_users")
    .insert({ display_name, role: "viewer" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
