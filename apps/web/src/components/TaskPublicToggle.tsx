"use client";
import { useState } from "react";

export function TaskPublicToggle({ taskId, ownerId, initialPublic }: { taskId: string; ownerId: string; initialPublic: boolean }) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [updating, setUpdating] = useState(false);

  const toggle = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: ownerId, is_public: !isPublic }),
      });
      const json = await res.json();
      if (json.data) setIsPublic(!isPublic);
    } catch {}
    setUpdating(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={updating}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
        isPublic
          ? "bg-green-900/50 text-green-300 hover:bg-green-900/30 border border-green-800"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
      } ${updating ? "opacity-50" : ""}`}
    >
      {updating ? "Updating..." : isPublic ? "This task is public" : "Make this task public →"}
    </button>
  );
}
