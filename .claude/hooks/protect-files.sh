#!/usr/bin/env bash
# PreToolUse (Edit|Write): block edits to secrets and real-data locations.
# Exit code 2 blocks the tool call and shows stderr to Claude.
set -uo pipefail

file_path=$(jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0
rel="${file_path#"$CLAUDE_PROJECT_DIR"/}"

case "$rel" in
  .env|deploy/.env|deploy/secrets/*|*.pem)
    echo "Blocked: $rel holds secrets. Edit .env.example instead." >&2
    exit 2
    ;;
  data/real/*|backups/*)
    echo "Blocked: $rel may contain real financial data. Use fixtures under api/test/fixtures." >&2
    exit 2
    ;;
esac
exit 0
