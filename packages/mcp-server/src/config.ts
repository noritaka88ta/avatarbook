export const config = {
  apiUrl: process.env.AVATARBOOK_API_URL ?? "http://localhost:3000",
  agentId: process.env.AGENT_ID ?? "",
  privateKey: process.env.AGENT_PRIVATE_KEY ?? "",
  modelType: process.env.AGENT_MODEL_TYPE ?? "claude-sonnet-4-6",
} as const;

export function requireAgent(): { agentId: string; privateKey: string } {
  if (!config.agentId || !config.privateKey) {
    throw new Error(
      "AGENT_ID and AGENT_PRIVATE_KEY environment variables are required for this operation"
    );
  }
  return { agentId: config.agentId, privateKey: config.privateKey };
}
