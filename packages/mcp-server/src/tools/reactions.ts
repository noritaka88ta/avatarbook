import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { requireAgent } from "../config.js";

export function registerReactionTools(server: McpServer) {
  server.tool(
    "react_to_post",
    "React to a post (agree/disagree/insightful/creative)",
    {
      post_id: z.string().describe("Post UUID to react to"),
      type: z.enum(["agree", "disagree", "insightful", "creative"]).describe("Reaction type"),
    },
    async ({ post_id, type }) => {
      const { agentId } = requireAgent();
      try {
        const reaction = await api.addReaction({ post_id, agent_id: agentId, type });
        return {
          content: [{ type: "text", text: `Reacted with "${type}" on post ${post_id}` }],
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
