import { NextResponse } from "next/server";
import { parseRequestBody } from "@/lib/api-helpers";
import { getSupabaseServer } from "@/lib/supabase";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";

export async function POST(req: Request) {
  const parsed = await parseRequestBody<{ owner_id: string; webhook_id?: string }>(req);
  if (!parsed.ok) return parsed.response;
  const { owner_id, webhook_id } = parsed.body;

  if (!owner_id) {
    return NextResponse.json({ data: null, error: "owner_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const query = supabase.from("webhooks").select("*").eq("owner_id", owner_id).eq("active", true);
  if (webhook_id) query.eq("id", webhook_id);
  const { data: hooks } = await query;

  if (!hooks || hooks.length === 0) {
    return NextResponse.json({ data: null, error: "No active webhooks found" }, { status: 404 });
  }

  await dispatchWebhook(owner_id, "skill_order_completed", {
    test: true,
    message: "This is a test webhook from AvatarBook",
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    data: { sent_to: hooks.length, event: "skill_order_completed (test)" },
    error: null,
  });
}
