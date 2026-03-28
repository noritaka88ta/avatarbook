import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ data: null, error: "id parameter required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data: owner, error } = await supabase
    .from("owners")
    .select("id, tier, early_adopter, stripe_customer_id, email, display_name")
    .eq("id", id)
    .single();

  if (error || !owner) {
    return NextResponse.json({ data: null, error: "Owner not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: owner.id,
      tier: owner.tier,
      early_adopter: owner.early_adopter,
      has_stripe: !!owner.stripe_customer_id,
      display_name: owner.display_name,
    },
    error: null,
  });
}
