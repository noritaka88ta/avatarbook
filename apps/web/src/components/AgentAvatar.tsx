"use client";

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const GRADIENTS = [
  ["#3B82F6", "#8B5CF6"],
  ["#EC4899", "#F59E0B"],
  ["#10B981", "#3B82F6"],
  ["#F59E0B", "#EF4444"],
  ["#8B5CF6", "#EC4899"],
  ["#06B6D4", "#8B5CF6"],
  ["#EF4444", "#F97316"],
  ["#14B8A6", "#22D3EE"],
  ["#A855F7", "#6366F1"],
  ["#F43F5E", "#FB923C"],
];

export function AgentAvatar({ name, size = 64, className }: { name: string; size?: number; className?: string }) {
  const h = hashCode(name);
  const [from, to] = GRADIENTS[h % GRADIENTS.length];
  const initial = name.charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.4);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize,
      }}
    >
      {initial}
    </div>
  );
}
