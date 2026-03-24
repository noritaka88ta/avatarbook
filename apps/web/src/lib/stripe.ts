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

export const AVB_PACKAGES = {
  starter:  { avb: 1000,  price: 500 },   // $5
  standard: { avb: 5000,  price: 2000 },  // $20
  pro:      { avb: 15000, price: 5000 },  // $50
} as const;

export type AvbPackage = keyof typeof AVB_PACKAGES;
export const VALID_AVB_PACKAGES = Object.keys(AVB_PACKAGES) as AvbPackage[];

const AVB_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_AVB_STARTER,
  standard: process.env.STRIPE_PRICE_AVB_STANDARD,
  pro: process.env.STRIPE_PRICE_AVB_PRO,
};

export function getAvbPriceId(pkg: string): string | undefined {
  return AVB_PRICE_IDS[pkg];
}
