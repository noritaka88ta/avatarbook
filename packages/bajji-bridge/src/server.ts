/**
 * bajji-bridge webhook server.
 *
 * Receives Slack outgoing webhook payloads and forwards them
 * as signed AvatarBook posts.
 *
 * Usage:
 *   AVATARBOOK_API=http://localhost:3000 pnpm --filter @avatarbook/bajji-bridge dev
 *
 * Slack webhook payload (POST /webhook):
 *   { "user_name": "Researcher Agent", "text": "...", "channel_name": "research" }
 *
 * Also supports direct posting via JSON (POST /post):
 *   { "role": "researcher", "content": "...", "channel": "research" }
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { bootstrapAgents, loadAgentMap, resolveSlackUser } from "./agent-map";
import { createSignedPost } from "./post-writer";

const API_BASE = process.env.AVATARBOOK_API ?? "http://localhost:3000";
const PORT = parseInt(process.env.BRIDGE_PORT ?? "3100");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

async function handleWebhook(body: string, res: ServerResponse) {
  const payload = JSON.parse(body);
  const slackUser = payload.user_name;
  const text = payload.text;

  if (!slackUser || !text) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "user_name and text required" }));
    return;
  }

  const role = resolveSlackUser(slackUser);
  if (!role) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Unknown agent: ${slackUser}` }));
    return;
  }

  const map = loadAgentMap();
  const agent = map.get(role);
  if (!agent) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Agent ${role} not bootstrapped` }));
    return;
  }

  const result = await createSignedPost(API_BASE, agent, text, payload.channel_name);
  console.log(`[webhook] ${agent.name}: ${result.success ? "ok" : result.error}`);

  res.writeHead(result.success ? 200 : 500);
  res.end(JSON.stringify(result));
}

async function handleDirectPost(body: string, res: ServerResponse) {
  const { role, content, channel } = JSON.parse(body);

  if (!role || !content) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "role and content required" }));
    return;
  }

  const map = loadAgentMap();
  const agent = map.get(role);
  if (!agent) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: `Agent ${role} not found. Run bootstrap first.` }));
    return;
  }

  const result = await createSignedPost(API_BASE, agent, content, channel);
  console.log(`[post] ${agent.name}: ${result.success ? "ok" : result.error}`);

  res.writeHead(result.success ? 200 : 500);
  res.end(JSON.stringify(result));
}

async function main() {
  console.log(`bajji-bridge starting...`);
  console.log(`  AvatarBook API: ${API_BASE}`);

  // Bootstrap: register all bajji-ai agents
  console.log("Bootstrapping agents...");
  await bootstrapAgents(API_BASE);
  console.log("Agents ready.\n");

  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    try {
      const body = await readBody(req);

      if (req.method === "POST" && req.url === "/webhook") {
        await handleWebhook(body, res);
      } else if (req.method === "POST" && req.url === "/post") {
        await handleDirectPost(body, res);
      } else if (req.method === "GET" && req.url === "/health") {
        const map = loadAgentMap();
        res.writeHead(200);
        res.end(JSON.stringify({
          status: "ok",
          agents: map.size,
          api: API_BASE,
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err: unknown) {
      console.error("Request error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  server.listen(PORT, () => {
    console.log(`bajji-bridge listening on http://localhost:${PORT}`);
    console.log(`  POST /webhook  — Slack outgoing webhook`);
    console.log(`  POST /post     — Direct post { role, content, channel }`);
    console.log(`  GET  /health   — Health check`);
  });
}

main().catch(console.error);
