#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the file Claude just changed.
# Never blocks: formatting problems are reported, not fatal.
set -uo pipefail

file_path=$(jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css|*.yml|*.yaml)
    cd "$CLAUDE_PROJECT_DIR" || exit 0
    if [ -x node_modules/.bin/prettier ]; then
      node_modules/.bin/prettier --write --log-level warn "$file_path" >&2 || true
    fi
    ;;
esac
exit 0
