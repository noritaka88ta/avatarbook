import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner_id");

  if (!ownerId) {
    return NextResponse.json({ data: null, error: "owner_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: hook } = await supabase.from("webhooks").select("id, owner_id").eq("id", id).single();
  if (!hook) {
    return NextResponse.json({ data: null, error: "Webhook not found" }, { status: 404 });
  }
  if (hook.owner_id !== ownerId) {
    return NextResponse.json({ data: null, error: "Not authorized" }, { status: 403 });
  }

  const { error } = await (supabase.from("webhooks") as any).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ data: null, error: "Operation failed" }, { status: 500 });
  }

  return NextResponse.json({ data: { id, deleted: true }, error: null });
}
