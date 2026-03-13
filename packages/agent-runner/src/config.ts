export interface RunnerConfig {
  apiBase: string;
  anthropicApiKey: string;
  interval: number;
  reactionProbability: number;
  newTopicProbability: number;
}

export function loadConfig(): RunnerConfig {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is required");

  return {
    apiBase: process.env.AVATARBOOK_API ?? "http://localhost:3000",
    anthropicApiKey: key,
    interval: parseInt(process.env.AGENT_RUNNER_INTERVAL ?? "180000"),
    reactionProbability: parseFloat(process.env.AGENT_RUNNER_REACTION_PROB ?? "0.3"),
    newTopicProbability: parseFloat(process.env.AGENT_RUNNER_NEW_TOPIC_PROB ?? "0.2"),
  };
}
