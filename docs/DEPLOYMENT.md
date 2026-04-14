# Guia de Deploy

## 1. Pre-requisitos

| Ferramenta     | Versao Minima   | Finalidade                             |
|----------------|-----------------|----------------------------------------|
| Docker         | 24+             | Runtime de containers para todos os servicos |
| Docker Compose | v2+             | Orquestracao multi-container           |
| Node.js        | 20+             | CLI (TypeScript/Ink)                   |
| Python         | 3.12+           | Servidor WS para criptografia de DB/proxy |
| Ruby           | 3.3+            | Servidor de relay C2                   |
| GCC            | 12+             | Compilacao nativa em C (ransom/testes) |
| mingw-w64      | 12+             | Cross-compilacao para Windows (agente C2) |
| OpenSSL        | 3.0+            | Bibliotecas de criptografia para compilacao C |
| Chromium       | qualquer        | Scraper do GitHub (Puppeteer)          |

---

## 2. Desenvolvimento Local (sem Docker)

### Instalar dependencias

```bash
# TypeScript CLI
npm ci

# Python server
pip install -r src-p/requirements.txt

# Ruby server
cd src-rb && bundle install && cd ..
```

### Iniciar servicos

Cada servico roda em seu proprio terminal.

**Servidor WS Python** (porta 4445 para gerenciamento, porta 1212 para proxy reverso):

```bash
cd src-p && python main.py
```

Variaveis de ambiente aceitas pelo servidor Python:

- `KEY_CRIP_DATA` -- chave de criptografia (obrigatoria para operacoes de DB)
- `MANAGEMENT_PORT` -- padrao 4445
- `AGENT_PORT` -- padrao 4444
- `DEBUG` -- "true" ou "false" (padrao "false")

**Servidor de relay C2 em Ruby** (porta 4444 para WebSocket, porta 8080 para HTTP health):

```bash
cd src-rb && bundle exec thin start -R config.ru -p 4444
```

Variaveis de ambiente aceitas pelo servidor Ruby:

- `OPERATOR_TOKEN` -- token de autenticacao (vazio = acesso aberto)
- `RACK_ENV` -- "development" ou "production"

**CLI TypeScript** (interface de terminal interativa):

```bash
npx tsx main.ts
```

A CLI espera `PYTHON_WS_URL` (padrao `ws://localhost:4445`) e `RUBY_WS_URL` (padrao `ws://localhost:4444`) para conectar aos servidores backend. Ao rodar localmente sem Docker, os valores padrao funcionam sem alteracao.

---

## 3. Docker em Producao

### Compilar todas as imagens

```bash
docker compose build
```

Ou usar o script de gerenciamento:

```bash
./scripts/docker-manage.sh build
```

### Iniciar servidores backend

```bash
docker compose up -d py-server rb-server
```

Isso inicia o servidor WS Python e o servidor de relay C2 em Ruby em segundo plano. Verifique se estao rodando:

```bash
docker compose ps
```

### Executar a CLI

```bash
docker compose run --rm cli
```

O container da CLI conecta ao `py-server` e `rb-server` pela rede Docker interna `attackmenu`. As variaveis de ambiente `PYTHON_WS_URL` e `RUBY_WS_URL` ja estao pre-configuradas no docker-compose.yml como `ws://py-server:4445` e `ws://rb-server:4444`.

### Compilar agentes C/C++

O servico de compilacao roda sob demanda (perfil efemero):

```bash
docker compose --profile build run --rm compiler bash
```

Dentro do container, use gcc para alvos Linux e mingw para alvos Windows. O diretorio `compiler/` esta montado em `/compiler`.

### Parar tudo

```bash
docker compose down
```

### Ciclo completo via script de gerenciamento

```bash
./scripts/docker-manage.sh build    # Compilar todas as imagens
./scripts/docker-manage.sh up       # Iniciar py-server + rb-server
./scripts/docker-manage.sh cli      # Executar CLI interativamente
./scripts/docker-manage.sh logs     # Acompanhar logs dos servidores
./scripts/docker-manage.sh status   # Mostrar status dos containers
./scripts/docker-manage.sh down     # Parar todos os containers
./scripts/docker-manage.sh clean    # Remover containers, volumes e imagens
```

---

## 4. Testes com Docker

### Iniciar bancos de dados de teste

```bash
docker compose -f docker-compose.test.yml up -d test-mongo test-mysql test-postgres test-redis
```

Isso inicia quatro bancos de dados com health checks:

| Servico       | Imagem       | Porta Host | Porta Container | Credenciais                        |
|---------------|-------------|-----------|----------------|------------------------------------|
| test-mongo    | mongo:7.0   | 17017     | 27017          | root / testpass123                 |
| test-mysql    | mysql:8.0   | 13306     | 3306           | root / testpass123                 |
| test-postgres | postgres:16 | 15432     | 5432           | postgres / testpass123             |
| test-redis    | redis:7     | 16379     | 6379           | sem autenticacao                   |

Todos os bancos usam `tmpfs` para armazenamento, portanto os dados sao perdidos ao parar o container.

### Rodar testes localmente contra os DBs no Docker

```bash
# TypeScript (sem dependencia de DB)
npx tsc --noEmit && npx vitest run

# Python (unitarios + integracao com DB)
KEY_CRIP_DATA=test-key-docker \
MONGO_TEST_URI="mongodb://root:testpass123@localhost:17017/testdb?authSource=admin" \
MYSQL_TEST_URI="mysql://root:testpass123@localhost:13306/testdb" \
PG_TEST_URI="postgresql://postgres:testpass123@localhost:15432/testdb" \
REDIS_TEST_URI="redis://localhost:16379/0" \
python3 -m pytest tests-p/ -v --timeout=30

# Ruby
rspec tests-rb/ --format documentation

# C crypto
gcc -O2 compiler/ransom/tests/test_crypto.c -o /tmp/test_crypto -lssl -lcrypto && /tmp/test_crypto
```

### Rodar todos os testes via Docker

```bash
docker compose -f docker-compose.test.yml run --rm test-all
```

Ou suites individuais:

```bash
docker compose -f docker-compose.test.yml run --rm test-py      # Python + DBs
docker compose -f docker-compose.test.yml run --rm test-rb      # Ruby
docker compose -f docker-compose.test.yml run --rm test-c       # C crypto
docker compose -f docker-compose.test.yml run --rm test-ransom  # Ransom fluxo completo
docker compose -f docker-compose.test.yml run --rm test-c2      # Agente C2 (Wine)
```

### Limpar ambiente de teste

```bash
docker compose -f docker-compose.test.yml down -v
```

### Executar tudo de uma vez (script de gerenciamento)

```bash
./scripts/docker-manage.sh test         # Suite completa: TS + Python + Ruby + C
./scripts/docker-manage.sh test-db      # Apenas testes de integracao com DB
./scripts/docker-manage.sh test-c2      # Compilacao do agente C2 + teste com Wine
./scripts/docker-manage.sh test-ransom  # Compilacao do ransom locker + teste de criptografia
```

---

## 5. Variaveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
chmod 0600 .env
```

| Variavel             | Tipo   | Padrao      | Obrigatoria | Descricao                                                      |
|----------------------|--------|-------------|-------------|----------------------------------------------------------------|
| `KEY_CRIP_DATA`      | string | (nenhum)    | Sim         | Chave de criptografia para operacoes de DB do ransom (AES-256-GCM) |
| `OPERATOR_TOKEN`     | string | (vazio)     | Nao         | Token de autenticacao para o relay C2 em Ruby. Vazio = acesso aberto |
| `COOKIE_GIT0`        | string | (vazio)     | Nao         | Cookie de sessao do GitHub para a conta 0 do scraper           |
| `COOKIE_GIT1`        | string | (vazio)     | Nao         | Cookie de sessao do GitHub para a conta 1 do scraper           |
| `COOKIE_GIT2`        | string | (vazio)     | Nao         | Cookie de sessao do GitHub para a conta 2 do scraper           |
| `PY_MANAGEMENT_PORT` | int    | 4445        | Nao         | Porta do host para o servidor WS de gerenciamento Python       |
| `PY_PROXY_PORT`      | int    | 1212        | Nao         | Porta do host para o proxy reverso Python                      |
| `RB_WS_PORT`         | int    | 4444        | Nao         | Porta do host para o servidor WebSocket Ruby                   |
| `RB_HTTP_PORT`       | int    | 8080        | Nao         | Porta do host para o endpoint HTTP health do Ruby              |
| `DEBUG`              | bool   | false       | Nao         | Habilitar logging de debug no servidor Python                  |
| `PYTHON_WS_URL`      | string | ws://localhost:4445 | Nao | URL WebSocket para a CLI alcancar o servidor Python (auto-configurada no Docker) |
| `RUBY_WS_URL`        | string | ws://localhost:4444 | Nao | URL WebSocket para a CLI alcancar o servidor Ruby (auto-configurada no Docker) |
| `EDGE_PATH`          | string | (sistema)   | Nao         | Caminho para o binario Chromium/Edge para o Puppeteer          |
| `MANAGEMENT_PORT`    | int    | 4445        | Nao         | Interno: porta de escuta do servidor Python (dentro do container) |
| `AGENT_PORT`         | int    | 4444        | Nao         | Interno: porta de relay do agente (dentro do container)        |
| `RACK_ENV`           | string | development | Nao         | Ambiente Ruby: development ou production                       |
| `RANSOM_MASTER_KEY`  | string | (nenhum)    | Nao         | Chave para descriptografar arquivos de chave privada `.pem.enc` em secrets/ |

---

## 6. Portas

| Porta | Protocolo | Servico                       | Descricao                                |
|-------|-----------|-------------------------------|------------------------------------------|
| 4444  | WebSocket | Servidor de relay C2 em Ruby  | Conexoes WebSocket de agentes e operadores |
| 4445  | WebSocket | Servidor de gerenciamento Python | Comandos de gerenciamento da CLI, operacoes de DB |
| 1212  | HTTP      | Proxy reverso Python          | Proxy reverso para interceptacao de trafego |
| 8080  | HTTP      | Endpoint HTTP Ruby            | Health check e API HTTP                  |

No ambiente de teste Docker, portas adicionais sao mapeadas:

| Porta | Servico       | Mapeia Para |
|-------|---------------|-------------|
| 17017 | test-mongo    | 27017       |
| 13306 | test-mysql    | 3306        |
| 15432 | test-postgres | 5432        |
| 16379 | test-redis    | 6379        |

---

## 7. Health Checks

### Servidor Python

O health check do Docker conecta na porta TCP 4445:

```bash
python -c "import socket; s=socket.create_connection(('localhost',4445),2); s.close()"
```

Verificacao manual a partir do host:

```bash
# Teste de conexao TCP
nc -z localhost 4445

# Ou via docker
docker inspect --format='{{.State.Health.Status}}' attackmenu-py-server
```

### Servidor Ruby

O health check do Docker acessa o endpoint HTTP `/health`:

```bash
curl -s http://localhost:4444/health
```

Verificacao manual a partir do host:

```bash
curl -s http://localhost:4444/health

# Ou via docker
docker inspect --format='{{.State.Health.Status}}' attackmenu-rb-server
```

### Bancos de dados de teste

Cada banco de dados de teste tem seu proprio health check configurado no docker-compose.test.yml. Aguarde todos ficarem saudaveis antes de rodar os testes:

```bash
docker compose -f docker-compose.test.yml up -d --wait test-mongo test-mysql test-postgres test-redis
```

Verificar status individual:

```bash
docker inspect --format='{{.State.Health.Status}}' test-mongo
docker inspect --format='{{.State.Health.Status}}' test-mysql
docker inspect --format='{{.State.Health.Status}}' test-postgres
docker inspect --format='{{.State.Health.Status}}' test-redis
```

---

## 8. Gerenciamento de Segredos

### Arquivo .env

- Armazene todos os segredos no `.env` na raiz do projeto.
- Defina permissoes restritivas: `chmod 0600 .env`.
- O `.gitignore` ja exclui `.env`, `*.cookies` e `secrets/`.
- Nunca commite segredos no git. Nunca logue credenciais completas.

### Diretorio secrets/

- Chaves privadas RSA (`.pem`) usadas para descriptografia do ransom ficam em `secrets/`.
- Arquivos de chave criptografados (`.pem.enc`) requerem `RANSOM_MASTER_KEY` para descriptografar.
- O diretorio `secrets/` e montado no container da CLI em `/app/secrets`.
- Faca backup deste diretorio separadamente. Chaves privadas perdidas nao podem ser regeneradas.

### Cookies do GitHub

- O scraper usa `COOKIE_GIT0` ate `COOKIE_GIT2` para autenticacao de sessao no GitHub.
- Eles expiram periodicamente e precisam ser renovados via DevTools do navegador.
- Extraia o header completo de cookie de uma sessao autenticada do GitHub.

---

## 9. Backup

### Itens criticos para backup

1. **Arquivo `.env`** -- Contem `KEY_CRIP_DATA`, que e a chave mestra de criptografia para todas as operacoes de DB. Se perdida, registros criptografados no banco de dados nao podem ser descriptografados.

2. **Diretorio `secrets/`** -- Contem chaves privadas RSA-2048 usadas para descriptografia do ransom. Sao geradas por operacao e nao podem ser recuperadas.

3. **`compiler/c2/vault.h`** -- Contem a configuracao de host/porta do servidor C2 embutida nos agentes compilados. Mantenha um registro de qual vault.h foi usado para cada agente compilado.

4. **`rules.json`** -- Configuracao de regras do proxy reverso, montado como somente leitura no container do servidor Python.

### Importancia do KEY_CRIP_DATA

`KEY_CRIP_DATA` e a chave simetrica usada pelo servidor Python para criptografar/descriptografar dados em bancos de dados alvo (MongoDB, MySQL, PostgreSQL, Firebase). Se este valor for alterado ou perdido:

- Todos os dados previamente criptografados se tornam irrecuperaveis.
- Novas operacoes usarao a nova chave e nao serao compativeis com dados antigos.
- Nao existe mecanismo de rotacao de chave -- alterar a chave requer re-criptografar todos os dados.

### Estrategia de backup

```bash
# Backup de segredos e configuracao (excluir dos backups regulares de codigo)
tar czf attackmenu-secrets-$(date +%Y%m%d).tar.gz .env secrets/ compiler/c2/vault.h rules.json
chmod 0600 attackmenu-secrets-*.tar.gz
```

Armazene o backup em um local separado e criptografado. Nao armazene junto ao repositorio de codigo.
