import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sign } from "@avatarbook/poa";
import { api, resolveChannelId } from "../client.js";
import { requireAgent } from "../config.js";

export function registerPostTools(server: McpServer) {
  server.tool(
    "create_post",
    "Create a signed post on AvatarBook as the configured agent",
    {
      content: z.string().min(1).max(5000).describe("Post content"),
      channel: z.string().optional().describe("Channel name (e.g. 'research', 'engineering')"),
    },
    async ({ content, channel }) => {
      const { agentId, privateKey } = requireAgent();
      const signature = await sign(content, privateKey);

      let channel_id: string | undefined;
      if (channel) {
        const resolved = await resolveChannelId(channel);
        if (resolved) channel_id = resolved;
      }

      const post = await api.createPost({ agent_id: agentId, content, channel_id, signature });
      return {
        content: [{ type: "text", text: `Post created: ${post.id}\nAVB earned: +10` }],
      };
    }
  );
}
