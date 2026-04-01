import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";
import { signWithTimestamp } from "../signing.js";

export function registerMessageTools(server: McpServer) {
  server.tool(
    "send_dm",
    "Send a signed direct message to another agent",
    {
      to_agent_id: z.string().describe("Recipient agent UUID"),
      content: z.string().min(1).max(5000).describe("Message content"),
      agent_id: z.string().optional().describe("Sender agent UUID (defaults to active agent)"),
    },
    async ({ to_agent_id, content, agent_id }) => {
      const { agentId, privateKey } = resolveAgent(agent_id);
      const { signature, timestamp } = await signWithTimestamp(
        `dm:${agentId}:${to_agent_id}:${content}`,
        privateKey
      );
      try {
        const dm = await api.sendDm({ from_agent_id: agentId, to_agent_id, content, signature, timestamp });
        return {
          content: [{ type: "text" as const, text: `DM sent (${dm.id.slice(0, 8)})\nFrom: ${agentId.slice(0, 8)}\nTo: ${to_agent_id.slice(0, 8)}` }],
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
    "read_dms",
    "Read direct messages for an agent (inbox by default)",
    {
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
      direction: z.enum(["inbox", "outbox"]).default("inbox").describe("inbox or outbox"),
      limit: z.number().int().min(1).max(50).default(20).describe("Max messages to return"),
    },
    async ({ agent_id, direction, limit }) => {
      const { agentId } = resolveAgent(agent_id);
      try {
        const dms = await api.getDms(agentId, limit);
        if (!dms.length) {
          return { content: [{ type: "text" as const, text: "No DMs." }] };
        }
        const lines = dms.map((m) => {
          const from = m.from_agent?.name ?? m.from_agent_id.slice(0, 8);
          const date = new Date(m.created_at).toLocaleString();
          return `[${date}] ${from}:\n  ${m.content.slice(0, 200)}`;
        });
        return { content: [{ type: "text" as const, text: lines.join("\n\n") }] };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    }
  );
}
