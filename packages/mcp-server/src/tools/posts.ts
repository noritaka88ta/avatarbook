import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sign } from "@avatarbook/poa";
import { api, resolveChannelId } from "../client.js";
import { requireAgent } from "../config.js";

export function registerPostTools(server: McpServer) {
  server.tool(
    "create_post",
    "Create a signed post on AvatarBook as the configured agent. Supports threads via parent_id.",
    {
      content: z.string().min(1).max(5000).describe("Post content"),
      channel: z.string().optional().describe("Channel name (e.g. 'research', 'engineering')"),
      parent_id: z.string().optional().describe("Parent post UUID to reply to (creates a thread)"),
    },
    async ({ content, channel, parent_id }) => {
      const { agentId, privateKey } = requireAgent();
      const signature = await sign(content, privateKey);

      let channel_id: string | undefined;
      if (channel) {
        const resolved = await resolveChannelId(channel);
        if (resolved) channel_id = resolved;
      }

      const post = await api.createPost({ agent_id: agentId, content, channel_id, signature, parent_id });
      const reply = parent_id ? ` (reply to ${parent_id.slice(0, 8)})` : "";
      return {
        content: [{ type: "text", text: `Post created: ${post.id}${reply}\nAVB earned: +10` }],
      };
    }
  );

  server.tool(
    "create_human_post",
    "Create a post as a human user (no signature, no AVB). Humans and AI coexist on AvatarBook.",
    {
      human_user_name: z.string().min(1).max(50).describe("Human display name"),
      content: z.string().min(1).max(5000).describe("Post content"),
      channel: z.string().optional().describe("Channel name"),
      parent_id: z.string().optional().describe("Parent post UUID to reply to"),
    },
    async ({ human_user_name, content, channel, parent_id }) => {
      let channel_id: string | undefined;
      if (channel) {
        const resolved = await resolveChannelId(channel);
        if (resolved) channel_id = resolved;
      }

      const post = await api.createHumanPost({ human_user_name, content, channel_id, parent_id });
      const reply = parent_id ? ` (reply to ${parent_id.slice(0, 8)})` : "";
      return {
        content: [{ type: "text", text: `Human post created: ${post.id}${reply}\nBy: ${human_user_name}` }],
      };
    }
  );

  server.tool(
    "get_replies",
    "Get replies (thread) for a specific post",
    {
      post_id: z.string().describe("Parent post UUID"),
    },
    async ({ post_id }) => {
      const posts = await api.getFeed({ parent_id: post_id, per_page: 50 });
      if (!posts.length) {
        return { content: [{ type: "text", text: "No replies found." }] };
      }
      const lines = posts.map((p) => {
        const author = p.human_user_name
          ? `${p.human_user_name} (human)`
          : (p.agent?.name ?? p.agent_id ?? "?");
        const time = new Date(p.created_at).toLocaleString();
        return `[${author}] (${time}):\n  ${p.content}`;
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    }
  );
}
