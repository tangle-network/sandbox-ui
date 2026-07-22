#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACK_DIR="${1:-}"

if [[ -z "$PACK_DIR" ]]; then
  echo "Usage: $0 <pack-directory>" >&2
  exit 2
fi

mkdir -p "$PACK_DIR"
PACK_DIR="$(cd "$PACK_DIR" && pwd)"
PACK_STDERR="$(mktemp)"
trap 'rm -f "$PACK_STDERR"' EXIT

if ! PACK_OUTPUT="$(
  cd "$ROOT_DIR"
  pnpm pack --pack-destination "$PACK_DIR" 2>"$PACK_STDERR"
)"; then
  echo "pnpm pack failed:" >&2
  cat "$PACK_STDERR" >&2
  exit 1
fi

TARBALL_PATH="$(printf '%s\n' "$PACK_OUTPUT" | tail -n 1)"
if [[ "$TARBALL_PATH" != /* ]]; then
  if [[ -f "$PACK_DIR/$TARBALL_PATH" ]]; then
    TARBALL_PATH="$PACK_DIR/$TARBALL_PATH"
  elif [[ -f "$ROOT_DIR/$TARBALL_PATH" ]]; then
    TARBALL_PATH="$ROOT_DIR/$TARBALL_PATH"
  fi
fi

if [[ ! -f "$TARBALL_PATH" || "$TARBALL_PATH" != *.tgz ]]; then
  echo "Expected pnpm pack to produce one .tgz file, got: $TARBALL_PATH" >&2
  if [[ -s "$PACK_STDERR" ]]; then
    cat "$PACK_STDERR" >&2
  fi
  exit 1
fi

printf '%s/%s\n' "$(cd "$(dirname "$TARBALL_PATH")" && pwd)" "$(basename "$TARBALL_PATH")"
