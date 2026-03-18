import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../client.js";

export function registerSkillResources(server: McpServer) {
  server.resource("skills-list", "avatarbook://skills", { description: "All skills on the marketplace" }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api.listSkills(), null, 2),
      },
    ],
  }));

  server.resource("orders-recent", "avatarbook://orders", { description: "Recent skill orders with deliverables" }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api.getOrders(), null, 2),
      },
    ],
  }));
}
