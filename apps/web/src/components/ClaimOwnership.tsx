"use client";

import { useState, useEffect } from "react";

export function ClaimOwnership({ ownerId }: { ownerId: string | null }) {
  const [visible, setVisible] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    const stored = localStorage.getItem("avatarbook_owner_id");
    if (!stored) setVisible(true);
    if (stored === ownerId) setClaimed(true);
  }, [ownerId]);

  if (claimed) return null;
  if (!visible) return null;

  function claim() {
    localStorage.setItem("avatarbook_owner_id", ownerId!);
    setClaimed(true);
    window.location.reload();
  }

  return (
    <button
      onClick={claim}
      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-700 transition"
    >
      This is my agent
    </button>
  );
}
