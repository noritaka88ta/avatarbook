import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "../client.js";
import { resolveAgent } from "../config.js";
import { signWithTimestamp } from "../signing.js";

export function registerBridgeTools(server: McpServer) {
  server.tool(
    "register_bridge",
    "Register a cross-platform bridge to an external MCP server (Verified tier only)",
    {
      mcp_server_url: z.string().min(5).max(2000).describe("External MCP server URL (HTTP JSON-RPC endpoint)"),
      mcp_server_name: z.string().min(1).max(200).describe("Display name for the MCP server (e.g. 'GitHub', 'Slack')"),
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ mcp_server_url, mcp_server_name, agent_id }) => {
      const { agentId, privateKey } = resolveAgent(agent_id);
      const { signature, timestamp } = await signWithTimestamp(
        `bridge:${agentId}:${mcp_server_name}`,
        privateKey,
      );
      try {
        const bridge = await api.createBridge({
          agent_id: agentId,
          mcp_server_url,
          mcp_server_name,
          signature,
          timestamp,
        });
        return {
          content: [{
            type: "text" as const,
            text: `Bridge registered: ${mcp_server_name}\nID: ${bridge.id}\nNext: use sync_bridge to import tools as skills`,
          }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_bridges",
    "List registered MCP bridges for an agent",
    {
      agent_id: z.string().optional().describe("Agent UUID (defaults to active agent)"),
    },
    async ({ agent_id }) => {
      const { agentId } = resolveAgent(agent_id);
      try {
        const bridges = await api.listBridges(agentId);
        if (!bridges.length) {
          return { content: [{ type: "text" as const, text: "No bridges registered." }] };
        }
        const lines = bridges.map((b) => {
          const tools = Array.isArray(b.tools_imported) ? b.tools_imported.length : 0;
          return `${b.mcp_server_name} (${tools} tools) [${b.active ? "active" : "inactive"}]\n  ID: ${b.id}\n  URL: ${b.mcp_server_url}`;
        });
        return { content: [{ type: "text" as const, text: lines.join("\n\n") }] };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "sync_bridge",
    "Sync tools from an external MCP server and register them as AvatarBook skills",
    {
      bridge_id: z.string().describe("Bridge UUID to sync"),
    },
    async ({ bridge_id }) => {
      try {
        const result = await api.syncBridge(bridge_id);
        if (result.synced === 0 && result.total_tools === 0) {
          return { content: [{ type: "text" as const, text: "No tools found on the MCP server." }] };
        }
        const lines = [
          `Synced: ${result.synced} new skills from ${result.total_tools} tools`,
          result.registered.length > 0 ? `Registered: ${result.registered.join(", ")}` : "No new tools to register (all already imported)",
        ];
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Failed: ${e.message}` }],
          isError: true,
        };
      }
    },
  );
}
