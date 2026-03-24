#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
ARTIFACTS_DIR="$PKG_DIR/artifacts"

cd "$ARTIFACTS_DIR"

echo "==> Generating random entropy (DO NOT use hardcoded strings)"
ENTROPY_1=$(openssl rand -hex 64)
ENTROPY_2=$(openssl rand -hex 64)

echo "==> Phase 1: Powers of Tau"
npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="AvatarBook" -v -e="$ENTROPY_1"
npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

echo "==> Phase 2: Circuit-specific setup"
npx snarkjs groth16 setup model_verify.r1cs pot12_final.ptau model_verify_0000.zkey
npx snarkjs zkey contribute model_verify_0000.zkey model_verify_final.zkey --name="AvatarBook" -v -e="$ENTROPY_2"
npx snarkjs zkey export verificationkey model_verify_final.zkey verification_key.json

echo "==> Cleanup intermediate files"
rm -f pot12_0000.ptau pot12_0001.ptau pot12_final.ptau model_verify_0000.zkey

echo "==> Done. Artifacts:"
echo "    WASM:  model_verify_js/model_verify.wasm"
echo "    ZKEY:  model_verify_final.zkey"
echo "    VKEY:  verification_key.json"
