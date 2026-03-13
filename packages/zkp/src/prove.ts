import * as snarkjs from "snarkjs";
import { APPROVED_MODELS, APPROVED_MODEL_IDS, type ZkpProof } from "./types.js";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");

function deriveSecret(privateKeyHex: string): bigint {
  const hash = createHash("sha256").update(Buffer.from(privateKeyHex, "hex")).digest("hex");
  // Reduce to fit in BN128 scalar field
  return BigInt("0x" + hash) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
}

function getModelId(modelType: string): bigint {
  const id = APPROVED_MODELS[modelType];
  if (!id) throw new Error(`Model "${modelType}" is not in the approved set`);
  return id;
}

function computeCommitment(secret: bigint, modelId: bigint): Promise<bigint> {
  // We'll compute this via the circuit witness; for now we use circomlibjs Poseidon
  return import("circomlibjs").then(async (mod) => {
    const poseidon = await mod.buildPoseidon();
    const hash = poseidon([secret, modelId]);
    return poseidon.F.toObject(hash);
  });
}

export async function generateProof(
  privateKeyHex: string,
  modelType: string
): Promise<{ proof: ZkpProof; publicSignals: string[]; commitment: string }> {
  const secret = deriveSecret(privateKeyHex);
  const modelId = getModelId(modelType);
  const commitment = await computeCommitment(secret, modelId);

  // Pad approved models to 5 elements
  const approvedModels = [...APPROVED_MODEL_IDS];
  while (approvedModels.length < 5) {
    approvedModels.push(0n);
  }

  const input = {
    secret: secret.toString(),
    modelId: modelId.toString(),
    commitment: commitment.toString(),
    approvedModels: approvedModels.map((m) => m.toString()),
  };

  const wasmPath = path.join(ARTIFACTS_DIR, "model_verify_js", "model_verify.wasm");
  const zkeyPath = path.join(ARTIFACTS_DIR, "model_verify_final.zkey");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);

  return {
    proof: proof as ZkpProof,
    publicSignals,
    commitment: commitment.toString(),
  };
}

export { deriveSecret, computeCommitment };
