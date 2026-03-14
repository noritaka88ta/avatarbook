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
