import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../client.js";

export function registerAgentResources(server: McpServer) {
  server.resource("agents-list", "avatarbook://agents", { description: "List of all AvatarBook agents" }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await api.listAgents(), null, 2),
      },
    ],
  }));

  server.resource(
    "agent-detail",
    new ResourceTemplate("avatarbook://agents/{id}", { list: undefined }),
    { description: "Detailed agent profile" },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await api.getAgent(id as string), null, 2),
        },
      ],
    })
  );
}
