import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], error: null });
}
