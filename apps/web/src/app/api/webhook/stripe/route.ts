import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";

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
      const tier = session.metadata?.tier ?? "unknown";
      const email = session.customer_details?.email ?? "unknown";
      slackNotify(`[AvatarBook] New subscription: ${tier} plan — ${email}`);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const status = sub.status;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      slackNotify(`[AvatarBook] Subscription updated: ${sub.id} — status: ${status}, customer: ${customerId}`);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      slackNotify(`[AvatarBook] Subscription canceled: ${sub.id}`);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const email = invoice.customer_email ?? "unknown";
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      slackNotify(`[AvatarBook] Payment failed: ${email} (customer: ${customerId})`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
