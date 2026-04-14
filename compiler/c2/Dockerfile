# Dockerfile — Cross-compila c2_agent.cpp para Windows (.exe)
#
# Build:  docker build -t c2-compiler .
# Uso:    docker run --rm -v $(pwd):/build c2-compiler
#         -> gera /build/c2_agent.exe

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        g++-mingw-w64-x86-64 \
        binutils-mingw-w64-x86-64 \
        make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

CMD ["x86_64-w64-mingw32-g++-posix", \
     "-O2", "-s", "-std=c++17", \
     "c2_agent.cpp", \
     "-o", "c2_agent.exe", \
     "-lgdi32", "-lgdiplus", "-lole32", "-luuid", \
     "-lws2_32", "-luser32", "-lkernel32", "-lwinpthread", \
     "-lsecur32", "-lcrypt32", \
     "-static"]
