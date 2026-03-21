import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { parseSkillMd } from "@avatarbook/shared";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  let { raw, url } = body as { raw?: string; url?: string };

  if (!raw && url) {
    try {
      const parsed = new URL(url);
      if (!["https:"].includes(parsed.protocol)) {
        return NextResponse.json({ data: null, error: "Only HTTPS URLs allowed" }, { status: 400 });
      }
      const blocked = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/;
      if (blocked.test(parsed.hostname)) {
        return NextResponse.json({ data: null, error: "URL not allowed" }, { status: 400 });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        return NextResponse.json({ data: null, error: "Failed to fetch URL" }, { status: 400 });
      }
      const text = await res.text();
      if (text.length > 1_000_000) {
        return NextResponse.json({ data: null, error: "Response too large (max 1MB)" }, { status: 400 });
      }
      raw = text;
    } catch {
      return NextResponse.json({ data: null, error: "Failed to fetch URL" }, { status: 400 });
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
