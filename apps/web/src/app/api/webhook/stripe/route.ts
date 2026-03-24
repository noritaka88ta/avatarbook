import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";
import { TIER_LIMITS } from "@avatarbook/shared";
import type { Tier } from "@avatarbook/shared";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const slackNotify = (text: string) => {
    if (!slackUrl) return;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    }).catch(() => {});
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata || {};

      if (meta.type === "avb_topup") {
        // AVB Top-up purchase
        const ownerId = meta.owner_id;
        const agentId = meta.agent_id || null;
        const avbAmount = parseInt(meta.avb_amount || "0", 10);
        const email = session.customer_details?.email ?? "unknown";

        if (ownerId && avbAmount > 0) {
          if (agentId) {
            // Credit specific agent
            await supabase.rpc("avb_credit", {
              p_agent_id: agentId,
              p_amount: avbAmount,
              p_reason: `AVB top-up (${meta.package})`,
            });
          } else {
            // Credit first agent owned by this owner
            const { data: agents } = await supabase
              .from("agents")
              .select("id")
              .eq("owner_id", ownerId)
              .limit(1);
            if (agents?.[0]) {
              await supabase.rpc("avb_credit", {
                p_agent_id: agents[0].id,
                p_amount: avbAmount,
                p_reason: `AVB top-up (${meta.package})`,
              });
            }
          }

          // Record transaction
          await supabase.from("avb_transactions").insert({
            owner_id: ownerId,
            to_id: agentId || null,
            amount: avbAmount,
            reason: `AVB top-up: ${meta.package}`,
            type: "topup",
            stripe_session_id: session.id,
          });

          slackNotify(`[AvatarBook] AVB top-up: +${avbAmount} AVB — ${email} (${meta.package})`);
        }
      } else {
        // Subscription checkout
        const tier = meta.tier ?? "unknown";
        const email = session.customer_details?.email ?? "unknown";
        const customerId = typeof session.customer === "string" ? session.customer : "";

        // Update owner tier
        if (customerId && tier !== "unknown") {
          await supabase
            .from("owners")
            .update({ tier, stripe_customer_id: customerId })
            .eq("stripe_customer_id", customerId);
          // Also try matching by email
          if (email !== "unknown") {
            await supabase
              .from("owners")
              .update({ tier, stripe_customer_id: customerId })
              .eq("email", email)
              .is("stripe_customer_id", null);
          }
        }

        slackNotify(`[AvatarBook] New subscription: ${tier} plan — ${email}`);
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : "";

      if (customerId) {
        // Find owner by stripe_customer_id
        const { data: owner } = await supabase
          .from("owners")
          .select("id, tier")
          .eq("stripe_customer_id", customerId)
          .single();

        if (owner) {
          const tier = owner.tier as Tier;
          const grant = TIER_LIMITS[tier]?.monthlyAvbGrant ?? 0;

          if (grant > 0) {
            // Credit monthly AVB grant across all owner's agents
            const { data: agents } = await supabase
              .from("agents")
              .select("id")
              .eq("owner_id", owner.id);

            if (agents && agents.length > 0) {
              const perAgent = Math.floor(grant / agents.length);
              for (const agent of agents) {
                await supabase.rpc("avb_credit", {
                  p_agent_id: agent.id,
                  p_amount: perAgent,
                  p_reason: `Monthly ${tier} grant`,
                });
              }

              await supabase.from("avb_transactions").insert({
                owner_id: owner.id,
                amount: grant,
                reason: `Monthly ${tier} AVB grant`,
                type: "monthly_grant",
              });
            }

            slackNotify(`[AvatarBook] Monthly grant: +${grant} AVB to ${agents?.length ?? 0} agents (${tier})`);
          }
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : "";
      slackNotify(`[AvatarBook] Subscription updated: ${sub.id} — status: ${sub.status}, customer: ${customerId}`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : "";

      // Downgrade to free
      if (customerId) {
        await supabase
          .from("owners")
          .update({ tier: "free" })
          .eq("stripe_customer_id", customerId);
      }

      slackNotify(`[AvatarBook] Subscription canceled: ${sub.id} — downgraded to free`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const email = invoice.customer_email ?? "unknown";
      slackNotify(`[AvatarBook] Payment failed: ${email}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
