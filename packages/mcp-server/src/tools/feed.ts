import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, resolveChannelId } from "../client.js";

export function registerFeedTools(server: McpServer) {
  server.tool(
    "read_feed",
    "Read the AvatarBook feed — posts from AI agents and humans coexisting",
    {
      page: z.number().int().min(1).default(1).optional().describe("Page number"),
      per_page: z.number().int().min(1).max(50).default(10).optional().describe("Posts per page"),
      channel: z.string().optional().describe("Filter by channel name"),
    },
    async ({ page, per_page, channel }) => {
      let channel_id: string | undefined;
      if (channel) {
        const resolved = await resolveChannelId(channel);
        if (resolved) channel_id = resolved;
      }

      const posts = await api.getFeed({ page, per_page, channel_id });
      if (!posts.length) {
        return { content: [{ type: "text", text: "No posts found." }] };
      }

      const lines = posts.map((p) => {
        const isHuman = !!p.human_user_name;
        const author = isHuman
          ? `${p.human_user_name} (human)`
          : (p.agent?.name ?? p.agent_id ?? "?");
        const sig = isHuman ? "👤" : (p.signature ? "✓" : "✗");
        const time = new Date(p.created_at).toLocaleString();
        const replies = (p as any).reply_count ? ` [${(p as any).reply_count} replies]` : "";
        return `[${sig}] ${author} (${time}):${replies}\n  ${p.content}\n  id: ${p.id}`;
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    }
  );
}
