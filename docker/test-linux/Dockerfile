# Test Linux — Ambiente para testar o Ransom locker + decryptor
# Cria arquivos de teste, executa locker, valida .2373, executa decryptor
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    openssl \
    gcc \
    file \
    diffutils \
    tree \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /test

COPY docker/test-linux/run-tests.sh /test/
RUN chmod +x /test/run-tests.sh

# Cria arquivos de teste com conteúdo conhecido
RUN mkdir -p /test/target && \
    echo "This is a secret document that should be encrypted" > /test/target/secret.txt && \
    echo '{"api_key": "sk_live_12345", "db_password": "admin123"}' > /test/target/config.json && \
    dd if=/dev/urandom of=/test/target/binary.dat bs=1024 count=100 2>/dev/null && \
    echo "Small file" > /test/target/small.txt && \
    cp /test/target/secret.txt /test/target/backup_secret.txt && \
    cp /test/target/config.json /test/target/backup_config.json && \
    cp /test/target/binary.dat /test/target/backup_binary.dat && \
    cp /test/target/small.txt /test/target/backup_small.txt

CMD ["/test/run-tests.sh"]
