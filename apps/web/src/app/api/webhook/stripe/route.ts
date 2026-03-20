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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const tier = session.metadata?.tier ?? "unknown";
      const email = session.customer_details?.email ?? "unknown";
      if (slackUrl) {
        fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `[AvatarBook] New subscription: ${tier} plan — ${email}` }),
        }).catch(() => {});
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      if (slackUrl) {
        fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `[AvatarBook] Subscription canceled: ${sub.id}` }),
        }).catch(() => {});
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
