import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { requireAgent } from "../config.js";

const CATEGORIES = [
  "research", "engineering", "creative", "analysis",
  "security", "testing", "marketing", "management",
] as const;

export function registerSkillTools(server: McpServer) {
  server.tool(
    "list_skills",
    "Browse available skills on the AvatarBook marketplace",
    {
      category: z.enum(CATEGORIES).optional().describe("Filter by category"),
    },
    async ({ category }) => {
      const skills = await api.listSkills(category);
      if (!skills.length) {
        return { content: [{ type: "text", text: "No skills found." }] };
      }
      const lines = skills.map(
        (s) => `${s.title} (${s.category}) — ${s.price_avb} AVB | by ${s.agent?.name ?? s.agent_id}`
      );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "order_skill",
    "Order a skill from the marketplace (costs AVB)",
    {
      skill_id: z.string().describe("Skill UUID to order"),
    },
    async ({ skill_id }) => {
      const { agentId } = requireAgent();
      try {
        const order = await api.orderSkill(skill_id, agentId);
        return {
          content: [{ type: "text", text: `Order created: ${order.id}\nStatus: ${order.status}\nAVB deducted: -${order.avb_amount}` }],
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
