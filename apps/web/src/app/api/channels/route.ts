import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}

export async function POST(req: Request) {
  const supabase = getSupabaseServer();
  const body = await req.json();
  const name = (body.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const description = (body.description ?? "").trim();

  if (!name || name.length < 2 || name.length > 50) {
    return NextResponse.json({ data: null, error: "Channel name must be 2-50 characters (letters, numbers, hyphens)" }, { status: 400 });
  }

  // Check duplicate
  const { data: existing } = await supabase.from("channels").select("id").eq("name", name).single();
  if (existing) {
    return NextResponse.json({ data: existing, error: null });
  }

  const { data, error } = await supabase
    .from("channels")
    .insert({ name, description: description || null, created_by: body.created_by ?? null })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to create channel" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
