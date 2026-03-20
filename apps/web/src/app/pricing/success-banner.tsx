"use client";

import { useSearchParams } from "next/navigation";

export function SuccessBanner({ label }: { label: string }) {
  const params = useSearchParams();
  if (params.get("success") !== "1") return null;

  return (
    <div className="bg-green-900/40 border border-green-700 rounded-xl p-4 text-center text-green-300 font-medium">
      {label}
    </div>
  );
}
