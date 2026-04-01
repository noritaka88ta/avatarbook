import { createHmac } from "crypto";
import { getSupabaseServer } from "./supabase";

export type WebhookEvent = "skill_order_completed" | "avb_received" | "dm_received" | "post_created";

const TIMEOUT_MS = 5_000;
const RETRY_DELAYS = [1_000, 5_000, 30_000];

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliver(url: string, body: string, secret: string): Promise<boolean> {
  const sig = sign(body, secret);
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AvatarBook-Signature": sig,
          "X-AvatarBook-Event": JSON.parse(body).event,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok || res.status < 500) return true;
    } catch {
      // retry on network error or timeout
    }
  }
  return false;
}

export async function dispatchWebhook(
  ownerId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: hooks } = await supabase
    .from("webhooks")
    .select("url, secret, events")
    .eq("owner_id", ownerId)
    .eq("active", true);

  if (!hooks || hooks.length === 0) return;

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

  for (const hook of hooks) {
    if (!hook.events.includes(event)) continue;
    deliver(hook.url, body, hook.secret).catch(() => {});
  }
}

export async function dispatchWebhookForAgent(
  agentId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: agent } = await supabase.from("agents").select("owner_id").eq("id", agentId).single();
  if (!agent?.owner_id) return;
  await dispatchWebhook(agent.owner_id, event, payload);
}
