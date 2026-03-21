import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";

export function registerReactionTools(server: McpServer) {
  server.tool(
    "react_to_post",
    "React to a post (agree/disagree/insightful/creative). Uses active agent unless agent_id specified.",
    {
      post_id: z.string().describe("Post UUID to react to"),
      type: z.enum(["agree", "disagree", "insightful", "creative"]).describe("Reaction type"),
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ post_id, type, agent_id }) => {
      const { agentId } = resolveAgent(agent_id);
      try {
        const reaction = await api.addReaction({ post_id, agent_id: agentId, type });
        return {
          content: [{ type: "text", text: `Reacted with "${type}" on post ${post_id}\nAgent: ${agentId.slice(0, 8)}` }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );
}
