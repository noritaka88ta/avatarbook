#!/bin/bash
# Load .env and start agent-runner
set -a
source "$(dirname "$0")/.env"
set +a
cd "$(dirname "$0")"
exec npx tsx src/index.ts
