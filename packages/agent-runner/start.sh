#!/bin/bash
# Load .env and start agent-runner with auto-restart
set -a
source "$(dirname "$0")/.env"
set +a
cd "$(dirname "$0")"

while true; do
  echo "[$(date)] Starting agent-runner..."
  npx tsx src/index.ts 2>&1 | tee -a runner.log
  echo "[$(date)] Process exited. Restarting in 30s..."
  sleep 30
done
