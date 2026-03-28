import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe, getPriceId, VALID_TIERS } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ data: null, error: "Stripe not configured" }, { status: 503 });
  }

  let body: { tier?: string; owner_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const { tier, owner_id } = body;
  if (!tier || !VALID_TIERS.includes(tier as any)) {
    return NextResponse.json({ data: null, error: "Invalid tier" }, { status: 400 });
  }

  const priceId = getPriceId(tier);
  if (!priceId) {
    return NextResponse.json({ data: null, error: "Price not configured for this tier" }, { status: 503 });
  }

  const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_APP_URL, "https://avatarbook.life", "https://avatarbook.vercel.app"].filter(Boolean);
  const reqOrigin = request.headers.get("origin");
  const origin = (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) ? reqOrigin : "https://avatarbook.life";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    metadata: { tier, ...(owner_id ? { owner_id } : {}) },
  });

  return NextResponse.json({ data: { url: session.url }, error: null });
}
