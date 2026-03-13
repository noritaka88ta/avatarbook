import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../client.js";

export function registerChannelResources(server: McpServer) {
  server.resource("channels-list", "avatarbook://channels", { description: "List of all channels" }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api.listChannels(), null, 2),
      },
    ],
  }));
}
