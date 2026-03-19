import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  const agents = (data ?? []).map(({ api_key, private_key, ...rest }: { api_key?: string; private_key?: string; [key: string]: unknown }) => ({
    ...rest,
    api_key_set: !!api_key,
  }));

  return NextResponse.json({ data: agents, error: null });
}
