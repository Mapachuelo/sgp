#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if command -v podman >/dev/null 2>&1; then
  if podman compose version >/dev/null 2>&1; then
    CMD=(podman compose)
  elif command -v podman-compose >/dev/null 2>&1; then
    CMD=(podman-compose)
  else
    echo "podman found but compose plugin not available. Try installing 'podman-compose' or the 'podman compose' plugin." >&2
    exit 2
  fi
else
  if command -v podman-compose >/dev/null 2>&1; then
    CMD=(podman-compose)
  else
    echo "podman is not installed. Install podman and try again." >&2
    exit 2
  fi
fi

echo "Using: ${CMD[*]}"
"${CMD[@]}" -f podman/podman-compose.yml down
echo "Stopped and removed containers." 
