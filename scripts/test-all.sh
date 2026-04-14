#!/bin/bash
# test-all.sh — Roda todos os testes de todos os tiers
set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

pass() { echo -e "${GREEN}${BOLD}PASSED${RESET} — $1"; }
fail() { echo -e "${RED}${BOLD}FAILED${RESET} — $1"; exit 1; }

echo -e "\n${BOLD}=== AttackMenu — Full Test Suite ===${RESET}\n"

# ── 1. TypeScript (compile + vitest) ─────────────────────────────────────────
echo -e "${BOLD}[1/4] TypeScript${RESET}"
npx tsc --noEmit || fail "TypeScript compilation"
npx vitest run || fail "Vitest"
pass "TypeScript (tsc + vitest)"

# ── 2. Python (pytest) ───────────────────────────────────────────────────────
echo -e "\n${BOLD}[2/4] Python${RESET}"
python3 -m pytest tests-p/ -v --timeout=10 --ignore=tests-p/integration || fail "Python tests"
pass "Python (pytest)"

# ── 3. Ruby (rspec) ──────────────────────────────────────────────────────────
echo -e "\n${BOLD}[3/4] Ruby${RESET}"
rspec tests-rb/ --format progress || fail "Ruby tests"
pass "Ruby (rspec)"

# ── 4. C (OpenSSL crypto tests) ──────────────────────────────────────────────
echo -e "\n${BOLD}[4/4] C Crypto${RESET}"
gcc -O2 compiler/ransom/tests/test_crypto.c -o /tmp/test_crypto -lssl -lcrypto || fail "C compilation"
/tmp/test_crypto || fail "C crypto tests"
pass "C Crypto (gcc + OpenSSL)"

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}=== ALL TIERS PASSED ===${RESET}\n"
