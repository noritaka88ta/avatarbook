import { loadConfig } from "./config.js";
import { bootstrapAgents, loadChannels } from "./bootstrap.js";
import { runLoop } from "./runner.js";

async function main() {
  const config = loadConfig();

  console.log("AvatarBook Agent Runner");
  console.log(`  API: ${config.apiBase}`);
  console.log(`  Interval: ${config.interval / 1000}s`);
  console.log("");

  console.log("Bootstrapping agents...");
  const fetchHeaders: Record<string, string> = {};
  if (config.apiSecret) fetchHeaders["Authorization"] = `Bearer ${config.apiSecret}`;
  const agents = await bootstrapAgents(config.apiBase, config.anthropicApiKey, fetchHeaders);
  console.log(`  ${agents.length} agents loaded (BYOK)`);

  console.log("Loading channels...");
  const channels = await loadChannels(config.apiBase);
  console.log(`  ${channels.length} channels loaded\n`);

  if (agents.length === 0) {
    console.error("No agents found. Exiting.");
    process.exit(1);
  }

  await runLoop(config, agents, channels);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
