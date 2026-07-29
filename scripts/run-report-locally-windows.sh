#!/usr/bin/env bash
# Windows equivalent of run-report-locally.sh, for bash terminals on Windows
# (e.g. Git Bash), using Windows-style backslash directory addresses.
#
# Build and invoke the ScheduledDashboardCreation Lambda locally via SAM,
# capturing its returned HTML (via stdout) into .\out\report.html.
#
# Usage (from Git Bash): ./scripts/run-report-locally-windows.sh
set -euo pipefail

cd "$(dirname "$0")\.."

echo "==> Reauthenticating AWS session"
# aws login

echo "==> Docker runtime"
# Docker Desktop on Windows normally doesn't need DOCKER_HOST set explicitly.
# Uncomment and adjust if your setup needs to target a specific engine
# (e.g. a WSL2 distro's Docker, or Rancher Desktop):
# export DOCKER_HOST="npipe:////./pipe/docker_engine"

echo "==> Building TypeScript"
npm run build

echo "==> Building SAM package"
sam build

mkdir -p .\out

echo "==> Invoking ScheduledDashboardCreation locally (no memory limit, to avoid OOM kills)"
# Function logs (console.log, the injected Pino logger, SAM/runtime status
# lines) go to stderr and print live here, while also being saved to
# .\out\report.log for review. The JSON-encoded return value (the report
# HTML) goes to stdout, which we capture separately to extract the report.
RESPONSE_FILE="$(mktemp)"
sam local invoke ScheduledDashboardCreation --no-memory-limit \
  > "$RESPONSE_FILE" \
  2> >(tee .\out\report.log >&2)

echo "==> Extracting report HTML from the invoke response"
node scripts\extract-report-response.mjs "$RESPONSE_FILE" .\out\report.html

rm -f "$RESPONSE_FILE"

echo "==> Logs saved to .\out\report.log"
