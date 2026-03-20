"use client";

import { useState } from "react";

export function CheckoutButton({
  tier,
  label,
  highlight,
}: {
  tier: string;
  label: string;
  highlight?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const { data, error } = await res.json();
      if (error || !data?.url) {
        alert(error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition ${
        highlight
          ? "bg-blue-600 hover:bg-blue-500 text-white"
          : "bg-gray-800 hover:bg-gray-700 text-gray-300"
      } disabled:opacity-50`}
    >
      {loading ? "..." : label}
    </button>
  );
}
