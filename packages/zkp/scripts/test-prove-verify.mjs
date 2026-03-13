import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as snarkjs from "snarkjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(__dirname, "..", "artifacts");

// Approved model IDs
const APPROVED = { "claude-opus-4-6": 1n, "claude-sonnet-4-6": 2n, "claude-haiku-4-5-20251001": 3n, "gpt-4o": 4n, "gemini-2.0-flash": 5n };
const FIELD = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// Derive secret from a fake Ed25519 private key
const fakePrivKey = "355d3c05cb1411f74ad6de502e6dd60b8a9bb2b3ae9d032a008e01896fff99da";
const hash = createHash("sha256").update(Buffer.from(fakePrivKey, "hex")).digest("hex");
const secret = BigInt("0x" + hash) % FIELD;
const modelId = APPROVED["claude-opus-4-6"];

// Compute Poseidon commitment using circomlibjs
const { buildPoseidon } = await import("circomlibjs");
const poseidon = await buildPoseidon();
const commitmentHash = poseidon([secret, modelId]);
const commitment = poseidon.F.toObject(commitmentHash);

console.log("Secret:", secret.toString().slice(0, 20) + "...");
console.log("Model ID:", modelId.toString());
console.log("Commitment:", commitment.toString().slice(0, 20) + "...");

// Generate proof
const input = {
  secret: secret.toString(),
  modelId: modelId.toString(),
  commitment: commitment.toString(),
  approvedModels: Object.values(APPROVED).map(v => v.toString()),
};

console.log("\n==> Generating proof...");
const wasmPath = path.join(ARTIFACTS, "model_verify_js", "model_verify.wasm");
const zkeyPath = path.join(ARTIFACTS, "model_verify_final.zkey");

const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
console.log("Proof generated. Public signals:", publicSignals.length);

// Verify proof
console.log("\n==> Verifying proof...");
const vkey = JSON.parse(readFileSync(path.join(ARTIFACTS, "verification_key.json"), "utf-8"));
const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
console.log("Verification result:", valid ? "✅ VALID" : "❌ INVALID");

// Test with tampered proof
console.log("\n==> Testing tampered proof...");
const tamperedSignals = [...publicSignals];
tamperedSignals[0] = "12345"; // wrong commitment
const tamperedValid = await snarkjs.groth16.verify(vkey, tamperedSignals, proof);
console.log("Tampered result:", tamperedValid ? "❌ Should have failed!" : "✅ Correctly rejected");

process.exit(valid && !tamperedValid ? 0 : 1);
