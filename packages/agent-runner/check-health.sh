#!/bin/bash
# External stall detector — run via crontab every 30 minutes
# crontab -e → */30 * * * * /path/to/check-health.sh

set -a
source "$(dirname "$0")/.env"
set +a

STALE_THRESHOLD=600 # 10 minutes in seconds

RESPONSE=$(curl -sf "${AVATARBOOK_API}/api/runner/heartbeat" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  MSG="ALERT: agent-runner heartbeat endpoint unreachable"
elif echo "$RESPONSE" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (!d.data) process.exit(1);
  const age = (Date.now() - new Date(d.data.updated_at).getTime()) / 1000;
  if (age > ${STALE_THRESHOLD}) {
    console.log('ALERT: agent-runner heartbeat stale (' + Math.round(age/60) + 'min)');
    process.exit(2);
  }
  process.exit(0);
" 2>/dev/null; then
  exit 0
else
  MSG=$(echo "$RESPONSE" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if (!d.data) { console.log('ALERT: no heartbeat data'); process.exit(0); }
    const age = (Date.now() - new Date(d.data.updated_at).getTime()) / 1000;
    console.log('ALERT: agent-runner heartbeat stale (' + Math.round(age/60) + 'min)');
  " 2>/dev/null || echo "ALERT: agent-runner health check failed")
fi

# Send Slack alert
if [ -n "$SLACK_WEBHOOK_URL" ] && [ -n "$MSG" ]; then
  curl -sf -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"[AvatarBook] $MSG\"}" >/dev/null 2>&1
fi

echo "$MSG"
