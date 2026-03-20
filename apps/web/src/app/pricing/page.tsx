import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";
import type { DictKey } from "@/lib/i18n/dict";
import { CheckoutButton } from "./checkout-button";
import { SuccessBanner } from "./success-banner";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const locale = await getLocale();

  const plans: {
    name: DictKey;
    price: DictKey;
    desc: DictKey;
    features: DictKey[];
    highlight?: boolean;
    tier?: string;
    cta: DictKey;
    badge?: string;
  }[] = [
    {
      name: "pricing.free",
      price: "pricing.freePrice",
      desc: "pricing.freeDesc",
      features: ["pricing.freeF1", "pricing.freeF2", "pricing.freeF3", "pricing.freeF4", "pricing.freeF5", "pricing.freeF6"],
      cta: "pricing.currentTier",
    },
    {
      name: "pricing.verified",
      price: "pricing.verifiedPrice",
      desc: "pricing.verifiedDesc",
      features: ["pricing.verifiedF1", "pricing.verifiedF2", "pricing.verifiedF3", "pricing.verifiedF4", "pricing.verifiedF5", "pricing.verifiedF6"],
      highlight: true,
      tier: "verified",
      cta: "pricing.subscribe",
      badge: "Most Popular",
    },
    {
      name: "pricing.builder",
      price: "pricing.builderPrice",
      desc: "pricing.builderDesc",
      features: ["pricing.builderF1", "pricing.builderF2", "pricing.builderF3", "pricing.builderF4", "pricing.builderF5", "pricing.builderF6"],
      tier: "builder",
      cta: "pricing.subscribe",
    },
    {
      name: "pricing.team",
      price: "pricing.teamPrice",
      desc: "pricing.teamDesc",
      features: ["pricing.teamF1", "pricing.teamF2", "pricing.teamF3", "pricing.teamF4", "pricing.teamF5", "pricing.teamF6"],
      tier: "team",
      cta: "pricing.subscribe",
    },
    {
      name: "pricing.enterprise",
      price: "pricing.enterprisePrice",
      desc: "pricing.enterpriseDesc",
      features: ["pricing.enterpriseF1", "pricing.enterpriseF2", "pricing.enterpriseF3", "pricing.enterpriseF4", "pricing.enterpriseF5", "pricing.enterpriseF6"],
      cta: "pricing.contactUs",
    },
  ];

  const faqs: { q: DictKey; a: DictKey }[] = [
    { q: "pricing.faqQ1", a: "pricing.faqA1" },
    { q: "pricing.faqQ2", a: "pricing.faqA2" },
    { q: "pricing.faqQ3", a: "pricing.faqA3" },
  ];

  return (
    <div className="space-y-16">
      <SuccessBanner label={t(locale, "pricing.paymentSuccess")} />

      {/* Header */}
      <section className="text-center space-y-4 pt-8">
        <h1 className="text-4xl md:text-5xl font-bold">{t(locale, "pricing.title")}</h1>
        <p className="text-xl text-gray-400">{t(locale, "pricing.subtitle")}</p>
      </section>

      {/* Plans Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl p-6 border flex flex-col ${
              plan.highlight
                ? "bg-blue-950/40 border-blue-700 ring-1 ring-blue-700/50"
                : "bg-gray-900 border-gray-800"
            }`}
          >
            {plan.badge && (
              <span className="text-xs font-medium text-blue-400 mb-2">{plan.badge}</span>
            )}
            <h3 className="text-lg font-bold">{t(locale, plan.name)}</h3>
            <div className="text-2xl font-bold mt-2">{t(locale, plan.price)}</div>
            <p className="text-sm text-gray-400 mt-2">{t(locale, plan.desc)}</p>
            <ul className="mt-4 space-y-2 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">+</span>
                  {t(locale, f)}
                </li>
              ))}
            </ul>
            {plan.tier ? (
              <CheckoutButton
                tier={plan.tier}
                label={t(locale, plan.cta)}
                highlight={plan.highlight}
              />
            ) : (
              <button
                className={`mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition ${
                  plan.cta === "pricing.currentTier"
                    ? "bg-gray-800 text-gray-400 cursor-default"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
                disabled={plan.cta === "pricing.currentTier"}
              >
                {t(locale, plan.cta)}
              </button>
            )}
          </div>
        ))}
      </section>

      {/* AVB Note */}
      <section className="text-center">
        <p className="text-sm text-gray-500 max-w-2xl mx-auto">
          {t(locale, "pricing.avbNote")}
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-center">{t(locale, "pricing.faq")}</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="font-medium">{t(locale, faq.q)}</h3>
              <p className="text-sm text-gray-400 mt-2">{t(locale, faq.a)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
