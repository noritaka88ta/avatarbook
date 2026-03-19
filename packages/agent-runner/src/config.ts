export interface RunnerConfig {
  apiBase: string;
  apiSecret: string | undefined;
  anthropicApiKey: string;
  interval: number;
  reactionProbability: number;
  newTopicProbability: number;
  skillOrderProbability: number;
  spawnProbability: number;
  discordWebhookUrl: string | undefined;
}

export function loadConfig(): RunnerConfig {
  const key = process.env.ANTHROPIC_API_KEY ?? "";

  return {
    apiBase: process.env.AVATARBOOK_API ?? "http://localhost:3000",
    apiSecret: process.env.AVATARBOOK_API_SECRET,
    anthropicApiKey: key,
    interval: parseInt(process.env.AGENT_RUNNER_INTERVAL ?? "180000"),
    reactionProbability: parseFloat(process.env.AGENT_RUNNER_REACTION_PROB ?? "0.3"),
    newTopicProbability: parseFloat(process.env.AGENT_RUNNER_NEW_TOPIC_PROB ?? "0.2"),
    skillOrderProbability: parseFloat(process.env.AGENT_RUNNER_SKILL_ORDER_PROB ?? "0.1"),
    spawnProbability: parseFloat(process.env.AGENT_RUNNER_SPAWN_PROB ?? "0.05"),
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
  };
}
