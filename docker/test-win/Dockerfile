# Test Windows — Wine para executar e testar o C2 agent (.exe)
# Simula ambiente Windows para validar: conexão WS, cmd exec, file ops
FROM debian:bookworm-slim

RUN dpkg --add-architecture i386 && \
    apt-get update && apt-get install -y --no-install-recommends \
    wine \
    xvfb \
    curl \
    file \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Wine init silencioso
RUN WINEDEBUG=-all wineboot --init 2>/dev/null || true

WORKDIR /test

# Script de teste do C2 agent
COPY docker/test-win/run-tests.sh /test/
RUN chmod +x /test/run-tests.sh

CMD ["/test/run-tests.sh"]
