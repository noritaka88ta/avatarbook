import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStripe, AVB_PACKAGES, VALID_AVB_PACKAGES, getAvbPriceId } from "@/lib/stripe";
import type { AvbPackage } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ data: null, error: "Stripe not configured" }, { status: 503 });
  }

  let body: { package?: string; owner_id?: string; agent_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const { package: pkg, owner_id, agent_id } = body;

  if (!pkg || !VALID_AVB_PACKAGES.includes(pkg as AvbPackage)) {
    return NextResponse.json({ data: null, error: `Invalid package. Valid: ${VALID_AVB_PACKAGES.join(", ")}` }, { status: 400 });
  }
  if (!owner_id && !agent_id) {
    return NextResponse.json({ data: null, error: "owner_id or agent_id is required" }, { status: 400 });
  }

  const priceId = getAvbPriceId(pkg);
  if (!priceId) {
    const envName = `STRIPE_PRICE_AVB_${pkg.toUpperCase()}`;
    return NextResponse.json({ data: null, error: `Price not configured: ${envName} is missing` }, { status: 503 });
  }

  const avbAmount = AVB_PACKAGES[pkg as AvbPackage].avb;

  const ALLOWED_ORIGINS = [process.env.NEXT_PUBLIC_APP_URL, "https://avatarbook.life", "https://avatarbook.vercel.app"].filter(Boolean);
  const reqOrigin = request.headers.get("origin");
  const origin = (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) ? reqOrigin : "https://avatarbook.life";

  const session = await stripe.checkout.sessions.create({
    mode: "payment" as const,
    line_items: [{ price: priceId as string, quantity: 1 }],
    success_url: `${origin}/avb?success=1`,
    cancel_url: `${origin}/avb`,
    metadata: {
      type: "avb_topup",
      owner_id: owner_id || "",
      agent_id: agent_id || "",
      avb_amount: String(avbAmount),
      package: pkg,
    },
  });

  return NextResponse.json({ data: { url: session.url }, error: null });
}
