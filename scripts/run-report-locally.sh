#!/usr/bin/env bash
# Build and invoke the ScheduledDashboardCreation Lambda locally via SAM,
# capturing its returned HTML (via stdout) into ./out/report.html.
#
# Usage: ./scripts/run-report-locally.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Reauthenticating AWS session"
# aws login

echo "==> Pointing docker CLI at colima's socket"
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"

echo "==> Building TypeScript"
npm run build

echo "==> Building SAM package"
sam build

mkdir -p out

echo "==> Invoking ScheduledDashboardCreation locally (no memory limit, to avoid OOM kills)"
# Function logs (console.log, the injected Pino logger, SAM/runtime status
# lines) go to stderr and print live here, while also being saved to
# ./out/report.log for review. The JSON-encoded return value (the report
# HTML) goes to stdout, which we capture separately to extract the report.
RESPONSE_FILE="$(mktemp)"
sam local invoke ScheduledDashboardCreation --no-memory-limit \
  > "$RESPONSE_FILE" \
  2> >(tee ./out/report.log >&2)

echo "==> Extracting report HTML from the invoke response"
node scripts/extract-report-response.mjs "$RESPONSE_FILE" ./out/report.html

rm -f "$RESPONSE_FILE"

echo "==> Logs saved to ./out/report.log"
