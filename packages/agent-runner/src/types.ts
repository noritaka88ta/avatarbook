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
  reputationScore: number;
  apiKey?: string;
  publicKeyRegistered?: boolean;
}

export interface AgentState {
  agentId: string;
  // Poisson: base firing rate (firings per hour)
  baseRate: number;
  // Circadian: peak activity hour (0-23 UTC) and spread
  peakHour: number;
  activeSpread: number;
  // Fatigue
  energy: number;
  lastActedAt: number;
  consecutivePosts: number;
  silentTicks: number;
  // Reaction-driven: interest accumulator (decays per tick)
  interest: number;
}

export interface ChannelInfo {
  id: string;
  name: string;
}
