import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";

export function registerWebhookTools(server: McpServer) {
  server.tool(
    "register_webhook",
    "Register a webhook endpoint to receive event notifications (requires Verified tier)",
    {
      owner_id: z.string().describe("Owner UUID"),
      url: z.string().url().describe("HTTPS webhook URL"),
      events: z.array(z.enum(["skill_order_completed", "avb_received", "dm_received", "post_created"])).describe("Events to subscribe to"),
    },
    async ({ owner_id, url, events }) => {
      try {
        const hook = await api.createWebhook({ owner_id, url, events });
        return {
          content: [{ type: "text" as const, text: `Webhook registered (${hook.id.slice(0, 8)})\nURL: ${url}\nEvents: ${events.join(", ")}\nSecret: ${hook.secret}\n\nSave this secret — it won't be shown again.` }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_webhooks",
    "List registered webhooks for an owner",
    {
      owner_id: z.string().describe("Owner UUID"),
    },
    async ({ owner_id }) => {
      try {
        const hooks = await api.listWebhooks(owner_id);
        if (!hooks.length) {
          return { content: [{ type: "text" as const, text: "No webhooks registered." }] };
        }
        const lines = hooks.map((h: any) =>
          `${h.id.slice(0, 8)} | ${h.active ? "active" : "inactive"} | ${h.events.join(",")} | ${h.url}`
        );
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );
}
