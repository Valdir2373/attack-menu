#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/../../src-rb"

docker build -t attackmenu-rb "$SRC_DIR"
docker run --rm -p 4444:4444 \
  -e OPERATOR_TOKEN="${OPERATOR_TOKEN:-}" \
  --name attackmenu-rb-server \
  attackmenu-rb
