import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ data: null, error: "Stripe not configured" }, { status: 503 });
  }

  const { owner_id } = await req.json();
  if (!owner_id) {
    return NextResponse.json({ data: null, error: "owner_id required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: owner } = await supabase
    .from("owners")
    .select("stripe_customer_id")
    .eq("id", owner_id)
    .single();

  if (!owner?.stripe_customer_id) {
    return NextResponse.json({ data: null, error: "No Stripe subscription found" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: owner.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://avatarbook.life"}/pricing`,
  });

  return NextResponse.json({ data: { url: session.url }, error: null });
}
