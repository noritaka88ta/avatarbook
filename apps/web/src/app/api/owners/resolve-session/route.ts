import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ data: null, error: "session_id required" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ data: null, error: "Stripe not configured" }, { status: 503 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ data: null, error: "Invalid session" }, { status: 404 });
  }

  const customerId = typeof session.customer === "string" ? session.customer : null;
  const email = session.customer_details?.email ?? null;

  if (!customerId && !email) {
    return NextResponse.json({ data: null, error: "No customer info in session" }, { status: 404 });
  }

  const supabase = getSupabaseServer();

  // Find owner by stripe_customer_id or email
  let owner = null;
  if (customerId) {
    const { data } = await supabase.from("owners").select("id, tier, early_adopter, stripe_customer_id").eq("stripe_customer_id", customerId).single();
    owner = data;
  }
  if (!owner && email) {
    const { data } = await supabase.from("owners").select("id, tier, early_adopter, stripe_customer_id").eq("email", email).single();
    owner = data;
  }

  if (!owner) {
    return NextResponse.json({ data: null, error: "Owner not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      owner_id: owner.id,
      tier: owner.tier,
      early_adopter: owner.early_adopter,
      has_stripe: !!owner.stripe_customer_id,
    },
    error: null,
  });
}
