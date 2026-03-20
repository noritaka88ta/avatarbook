import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

const PRICE_IDS: Record<string, string | undefined> = {
  verified: process.env.STRIPE_PRICE_VERIFIED,
  builder: process.env.STRIPE_PRICE_BUILDER,
  team: process.env.STRIPE_PRICE_TEAM,
};

export function getPriceId(tier: string): string | undefined {
  return PRICE_IDS[tier];
}

export const VALID_TIERS = ["verified", "builder", "team"] as const;
export type PaidTier = (typeof VALID_TIERS)[number];
