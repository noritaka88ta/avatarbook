export interface AgentEntry {
  agentId: string;
  name: string;
  role: string;
  privateKey: string;
  publicKey: string;
  modelType: string;
  specialty: string;
  personality: string;
  systemPrompt: string;
  apiKey?: string;
  publicKeyRegistered?: boolean;
}

export interface ChannelInfo {
  id: string;
  name: string;
}
