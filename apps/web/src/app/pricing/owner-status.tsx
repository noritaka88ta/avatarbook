"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface OwnerStatus {
  id: string;
  tier: string;
  early_adopter: boolean;
  has_stripe: boolean;
  display_name: string | null;
}

export function OwnerStatusBanner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function resolve() {
      // 1. If coming back from Stripe checkout, resolve session_id → owner_id
      const sessionId = params.get("session_id");
      if (sessionId) {
        try {
          const res = await fetch(`/api/owners/resolve-session?session_id=${sessionId}`);
          const json = await res.json();
          if (json.data?.owner_id) {
            localStorage.setItem("avatarbook_owner_id", json.data.owner_id);
            setStatus({
              id: json.data.owner_id,
              tier: json.data.tier,
              early_adopter: json.data.early_adopter,
              has_stripe: json.data.has_stripe,
              display_name: null,
            });
            return;
          }
        } catch {}
      }

      // 2. If URL has owner_id param, save it
      const urlOwnerId = params.get("owner_id");
      if (urlOwnerId) {
        localStorage.setItem("avatarbook_owner_id", urlOwnerId);
      }

      // 3. Check localStorage
      const ownerId = urlOwnerId || localStorage.getItem("avatarbook_owner_id");
      if (!ownerId) return;

      try {
        const res = await fetch(`/api/owners/status?id=${ownerId}`);
        const json = await res.json();
        if (json.data) {
          setStatus({ ...json.data, id: ownerId });
        }
      } catch {}
    }

    resolve();
  }, [params]);

  if (!status) return null;

  const isPaid = status.tier !== "free" || status.early_adopter;
  const tierLabel = status.early_adopter
    ? "Early Adopter"
    : status.tier.charAt(0).toUpperCase() + status.tier.slice(1);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/owners/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: status!.id }),
      });
      const { data, error } = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert(error ?? "Could not open billing portal");
      }
    } catch {
      alert("Network error");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className={`rounded-xl p-4 border ${
      isPaid
        ? "bg-green-950/30 border-green-700/50"
        : "bg-gray-900 border-gray-800"
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`text-lg ${isPaid ? "text-green-400" : "text-gray-500"}`}>
            {isPaid ? "\u2713" : "\u25CB"}
          </span>
          <div>
            <div className="font-medium text-sm">
              {isPaid ? `Active \u2014 ${tierLabel}` : "Free tier"}
            </div>
            {status.display_name && (
              <div className="text-xs text-gray-500">{status.display_name}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.has_stripe && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition disabled:opacity-50"
            >
              {portalLoading ? "..." : "Manage subscription"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
