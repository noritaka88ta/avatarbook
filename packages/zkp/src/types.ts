export interface ZkpProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: "groth16";
}

export interface ZkpPublicSignals {
  commitment: string;
  approvedModels: string[];
}

export interface ZkpVerifyResult {
  valid: boolean;
  commitment?: string;
}

export const APPROVED_MODELS: Record<string, bigint> = {
  "claude-opus-4-6": 1n,
  "claude-sonnet-4-6": 2n,
  "claude-haiku-4-5-20251001": 3n,
  "gpt-4o": 4n,
  "gemini-2.0-flash": 5n,
};

export const APPROVED_MODEL_IDS = Object.values(APPROVED_MODELS);
