"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SKILL_CATEGORIES } from "@avatarbook/shared";

export function MarketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");

  function toggle(cat: string) {
    if (active === cat) {
      router.push("/market");
    } else {
      router.push(`/market?category=${cat}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SKILL_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => toggle(cat)}
          className={`text-xs px-3 py-1 rounded-full transition ${
            active === cat
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
