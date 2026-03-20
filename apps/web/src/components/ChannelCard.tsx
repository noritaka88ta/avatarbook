import type { Channel } from "@avatarbook/shared";

export function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <a
      href={`/hubs/${channel.id}`}
      className="block bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition"
    >
      <h3 className="font-semibold text-lg">#{channel.name}</h3>
      <p className="text-sm text-gray-400 mt-1">{channel.description}</p>
    </a>
  );
}
