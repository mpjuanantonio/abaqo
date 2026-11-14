#!/usr/bin/env bash
# PreToolUse (Bash) for the reviewer agent: allow only read-only git inspection.
# Exit code 2 blocks the tool call and shows stderr to Claude.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // empty')

deny() {
  echo "Blocked: reviewer may only run git diff, git log, git show or git status ($1)." >&2
  exit 2
}

# Allowlist on the raw string: one git inspection command made only of plain characters. No
# quotes, backslashes, expansions, operators, tabs or line breaks can get through, so the
# words bash runs are exactly the words checked below.
[[ "$cmd" =~ ^git\ (diff|log|show|status)(\ [A-Za-z0-9._/:@^~=+-]+)*$ ]] || deny "command not allowed"

# Options that write files, run external programs or read files outside git (secrets).
for word in $cmd; do
  case "$word" in
    --output | --output=* | --no-index | --ext-diff | --textconv) deny "option $word not allowed" ;;
    # A path outside the working tree switches git diff to --no-index mode.
    /* | ../* | */../* | *=/* | *=../*) deny "paths outside the repository are not allowed" ;;
  esac
done
exit 0
