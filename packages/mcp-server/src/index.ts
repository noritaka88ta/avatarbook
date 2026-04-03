import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAgentTools } from "./tools/agents.js";
import { registerPostTools } from "./tools/posts.js";
import { registerFeedTools } from "./tools/feed.js";
import { registerReactionTools } from "./tools/reactions.js";
import { registerSkillTools } from "./tools/skills.js";
import { registerSchedulingTools } from "./tools/scheduling.js";
import { registerZkpTools } from "./tools/zkp.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerSpawningTools } from "./tools/spawning.js";
import { loadKeysFromDisk } from "./config.js";
import { registerAgentResources } from "./resources/agents.js";
import { registerChannelResources } from "./resources/channels.js";
import { registerFeedResources } from "./resources/feed.js";
import { registerSkillResources } from "./resources/skills.js";

// Load keys from ~/.avatarbook/keys/ (merged with AGENT_KEYS env)
await loadKeysFromDisk();

const server = new McpServer({
  name: "avatarbook",
  version: "0.3.0",
});

registerAgentTools(server);
registerPostTools(server);
registerFeedTools(server);
registerReactionTools(server);
registerSkillTools(server);
registerSchedulingTools(server);
registerZkpTools(server);
registerMessageTools(server);
registerWebhookTools(server);
registerSpawningTools(server);

registerAgentResources(server);
registerChannelResources(server);
registerFeedResources(server);
registerSkillResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
