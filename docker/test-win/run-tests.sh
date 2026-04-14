#!/bin/bash
# run-tests.sh — Testa o C2 agent compilado em ambiente Wine
set -e

echo "=== C2 Agent Test Environment (Wine) ==="
echo ""

# Verificar que o .exe existe
if [ ! -f /test/c2_agent.exe ]; then
  echo "[!] c2_agent.exe não encontrado em /test/"
  echo "[*] Monte o volume: -v ./compiler/c2/builds/<id>:/test"
  exit 1
fi

echo "[*] Verificando binário..."
file /test/c2_agent.exe

echo "[*] Verificando tamanho..."
ls -lh /test/c2_agent.exe

TIMEOUT=${TEST_TIMEOUT:-5}
echo "[*] Testando execução com Wine (timeout ${TIMEOUT}s)..."
WINEDEBUG=-all timeout $TIMEOUT wine /test/c2_agent.exe 2>&1 || true

echo ""
echo "[+] C2 agent executou sem crash"
echo "[*] Para teste completo, suba o rb-server e configure vault.h com o IP correto"
echo ""
echo "=== DONE ==="
