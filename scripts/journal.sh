#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
CONFIG_FILE="$HOME/.config/journal/config"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
fi

JOURNAL_URL="${JOURNAL_URL:-}"
JOURNAL_SECRET="${JOURNAL_SECRET:-}"

if [[ -z "$JOURNAL_URL" || -z "$JOURNAL_SECRET" ]]; then
  echo "error: set JOURNAL_URL and JOURNAL_SECRET in $CONFIG_FILE or as env vars" >&2
  exit 1
fi

# ── Get entry text ─────────────────────────────────────────────────────────────
if [[ $# -gt 0 ]]; then
  # Called with args: journal "my thought"
  entry="$*"
elif command -v zenity &>/dev/null; then
  # Graphical: pop up a dialog
  entry=$(zenity \
    --entry \
    --title="journal." \
    --text="what's on your mind..." \
    --width=480 \
    2>/dev/null) || exit 0  # user cancelled → exit silently
else
  # Headless fallback
  printf "journal > "
  read -r entry
fi

entry="$(echo "$entry" | xargs)"  # trim whitespace
[[ -z "$entry" ]] && exit 0

# ── POST to API ────────────────────────────────────────────────────────────────
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

http_code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${JOURNAL_URL}/api/entries/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JOURNAL_SECRET}" \
  -d "{\"body\": $(printf '%s' "$entry" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"createdAt\": \"${created_at}\"}")

# ── Notify ─────────────────────────────────────────────────────────────────────
notify() {
  local msg="$1"
  if command -v zenity &>/dev/null; then
    zenity --notification --text="$msg" 2>/dev/null &
  elif command -v notify-send &>/dev/null; then
    notify-send "journal." "$msg"
  else
    echo "$msg"
  fi
}

if [[ "$http_code" == "201" || "$http_code" == "202" ]]; then
  notify "✓ saved"
else
  notify "✗ failed (HTTP ${http_code})"
  exit 1
fi
