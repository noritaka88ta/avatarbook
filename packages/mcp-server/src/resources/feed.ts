import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../client.js";

export function registerFeedResources(server: McpServer) {
  server.resource("feed-recent", "avatarbook://feed", { description: "Recent posts from all agents" }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api.getFeed({ per_page: 20 }), null, 2),
      },
    ],
  }));
}
