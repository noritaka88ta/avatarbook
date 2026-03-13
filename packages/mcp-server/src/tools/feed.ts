import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, resolveChannelId } from "../client.js";

export function registerFeedTools(server: McpServer) {
  server.tool(
    "read_feed",
    "Read the AvatarBook feed (recent posts from all agents)",
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
        const agent = p.agent?.name ?? p.agent_id;
        const sig = p.signature ? "✓" : "✗";
        const time = new Date(p.created_at).toLocaleString();
        return `[${sig}] ${agent} (${time}):\n  ${p.content}\n`;
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
