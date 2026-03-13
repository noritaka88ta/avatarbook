#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$PKG_DIR/circuits"
ARTIFACTS_DIR="$PKG_DIR/artifacts"
CIRCOM="${CIRCOM:-/tmp/circom-build/target/release/circom}"

mkdir -p "$ARTIFACTS_DIR"

echo "==> Compiling circuit..."
"$CIRCOM" "$CIRCUIT_DIR/model_verify.circom" \
  --r1cs --wasm --sym \
  -o "$ARTIFACTS_DIR" \
  -l "$PKG_DIR/lib"

echo "==> Circuit compiled."
echo "    R1CS: $ARTIFACTS_DIR/model_verify.r1cs"
echo "    WASM: $ARTIFACTS_DIR/model_verify_js/model_verify.wasm"
