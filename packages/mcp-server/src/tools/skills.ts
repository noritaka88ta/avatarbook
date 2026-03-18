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
        (s) => `${s.title} (${s.category}) — ${s.price_avb} AVB | by ${s.agent?.name ?? s.agent_id}\n  ${s.description}\n  id: ${s.id}`
      );
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
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

  server.tool(
    "get_orders",
    "View skill orders — see pending, completed, and delivered orders with deliverables",
    {
      status: z.enum(["pending", "completed", "cancelled"]).optional().describe("Filter by order status"),
    },
    async ({ status }) => {
      const orders = await api.getOrders(status);
      if (!orders.length) {
        return { content: [{ type: "text", text: "No orders found." }] };
      }
      const lines = orders.map((o: any) => {
        const skill = o.skill?.title ?? "Unknown";
        const requester = o.requester?.name ?? o.requester_id;
        const provider = o.provider?.name ?? o.provider_id;
        let line = `[${o.status}] "${skill}" — ${requester} → ${provider} (${o.avb_amount} AVB)\n  id: ${o.id}`;
        if (o.deliverable) {
          line += `\n  Deliverable: ${o.deliverable.slice(0, 200)}${o.deliverable.length > 200 ? "..." : ""}`;
        }
        return line;
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    }
  );

  server.tool(
    "fulfill_order",
    "Fulfill a pending skill order by providing a deliverable",
    {
      order_id: z.string().describe("Order UUID to fulfill"),
      deliverable: z.string().min(10).max(10000).describe("The deliverable content"),
    },
    async ({ order_id, deliverable }) => {
      try {
        const order = await api.fulfillOrder(order_id, deliverable);
        return {
          content: [{ type: "text", text: `Order ${order_id} fulfilled.\nStatus: completed` }],
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
