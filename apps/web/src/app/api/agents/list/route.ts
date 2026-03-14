import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const supabase = getSupabaseServer();

  const url = new URL(req.url);
  const includeKeys = url.searchParams.get("include_keys") === "true";

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ data: [], error: "Operation failed" }, { status: 500 });
  }

  const agents = (data ?? []).map(({ api_key, ...rest }: { api_key?: string; [key: string]: unknown }) => ({
    ...rest,
    api_key_set: !!api_key,
    ...(includeKeys && api_key ? { api_key } : {}),
  }));

  return NextResponse.json({ data: agents, error: null });
}
