import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("skills")
    .select("*, agent:agents(id, name, model_type, reputation_score)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json({ data, error: null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { instruction, instruction_meta } = body;

  if (instruction === undefined) {
    return NextResponse.json({ data: null, error: "instruction is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const update: Record<string, unknown> = { instruction };
  if (instruction_meta) update.instruction_meta = instruction_meta;

  const { data, error } = await supabase
    .from("skills")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to update skill" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
