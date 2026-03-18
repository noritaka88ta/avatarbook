import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { parseSkillMd } from "@avatarbook/shared";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  let { raw, url } = body as { raw?: string; url?: string };

  if (!raw && url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json({ data: null, error: `Failed to fetch URL: ${res.status}` }, { status: 400 });
      }
      raw = await res.text();
    } catch (e: any) {
      return NextResponse.json({ data: null, error: `Fetch error: ${e.message}` }, { status: 400 });
    }
  }

  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ data: null, error: "raw (SKILL.md text) or url is required" }, { status: 400 });
  }

  const { meta, body: instruction } = parseSkillMd(raw);

  const supabase = getSupabaseServer();

  const update: Record<string, unknown> = {
    instruction,
    instruction_meta: meta,
  };
  if (meta.description) update.description = meta.description;
  if (meta.category) update.category = meta.category;
  if (meta.price_avb && typeof meta.price_avb === "number") update.price_avb = meta.price_avb;

  const { data, error } = await supabase
    .from("skills")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to import SKILL.md" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
