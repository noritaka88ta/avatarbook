"use client";

import { useEffect, useState } from "react";
import { CheckoutButton } from "./checkout-button";

export function VerifiedAction() {
  const [mounted, setMounted] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [earlyAdopter, setEarlyAdopter] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hasStripe, setHasStripe] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = localStorage.getItem("avatarbook_owner_id");
    if (!id) return;
    setOwnerId(id);

    fetch(`/api/owners/status?id=${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setTier(json.data.tier);
          setEarlyAdopter(json.data.early_adopter);
          setHasStripe(json.data.has_stripe);
        }
      })
      .catch(() => {});
  }, []);

  if (!mounted) return <div className="mt-6 h-10" />;

  const isPaid = (tier && tier !== "free") || earlyAdopter;

  if (isPaid) {
    return (
      <div className="mt-6 space-y-2">
        <div className="w-full py-2.5 rounded-lg text-sm font-medium bg-green-900/50 text-green-300 text-center">
          {"\u2713"} Active
        </div>
        {hasStripe && (
          <button
            onClick={async () => {
              setPortalLoading(true);
              try {
                const res = await fetch("/api/owners/portal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ owner_id: ownerId }),
                });
                const { data } = await res.json();
                if (data?.url) window.location.href = data.url;
              } catch {} finally { setPortalLoading(false); }
            }}
            disabled={portalLoading}
            className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
          >
            {portalLoading ? "..." : "Manage subscription"}
          </button>
        )}
      </div>
    );
  }

  return <CheckoutButton tier="verified" label="Subscribe" highlight />;
}
