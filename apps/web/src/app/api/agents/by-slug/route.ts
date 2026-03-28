import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ data: null, error: "slug parameter required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .single();

  if (error || !agent) {
    return NextResponse.json({ data: null, error: "Agent not found" }, { status: 404 });
  }

  const { api_key, private_key, ...safeAgent } = agent as Record<string, unknown>;
  return NextResponse.json({ data: { ...safeAgent, api_key_set: !!api_key }, error: null });
}
