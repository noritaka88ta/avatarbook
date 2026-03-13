import * as snarkjs from "snarkjs";
import type { ZkpProof, ZkpVerifyResult } from "./types.js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VKEY_PATH = path.join(__dirname, "..", "artifacts", "verification_key.json");

let vkey: object | null = null;

function loadVKey(): object {
  if (!vkey) {
    vkey = JSON.parse(readFileSync(VKEY_PATH, "utf-8"));
  }
  return vkey!;
}

export async function verifyProof(
  proof: ZkpProof,
  publicSignals: string[]
): Promise<ZkpVerifyResult> {
  const verificationKey = loadVKey();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof as any);
  return {
    valid,
    commitment: publicSignals[0],
  };
}
