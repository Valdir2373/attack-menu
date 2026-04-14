# AttackMenu

AttackMenu e um toolkit ofensivo multi-linguagem construido para testes de penetracao autorizados e operacoes de red team. Ele combina uma interface de terminal (TypeScript/Ink) com servicos de backend (Python, Ruby) e agentes compilados (C/C++) para fornecer validacao de credenciais, criptografia de bancos de dados (simulacao de ransomware), um C2 RAT com controle remoto completo, proxy reverso com filtragem de conteudo, scraping de credenciais no GitHub e monitoramento IMAP -- tudo orquestrado atraves de uma unica CLI interativa.

---

## Stack Tecnologica

| Camada | Linguagem | Funcao | Runtime |
|--------|-----------|--------|---------|
| CLI | TypeScript / React Ink | Interface de terminal interativa, orquestracao | Node.js + tsx |
| Servidor WS | Python / asyncio | Criptografia de bancos de dados, proxy reverso | Python 3.12 |
| Relay C2 | Ruby / Sinatra + Faye | Relay de agentes C2, API do operador | Ruby 3.3 |
| Agentes | C / C++ | RAT Windows, locker/decryptor de ransomware | gcc / x86_64-w64-mingw32-g++ |
| Infra | Docker Compose | Orquestracao de servicos, compilador efemero | Docker |

---

## Inicio Rapido

```bash
git clone https://github.com/Valdir2373/atack.git
cd atack

cp .env.example .env
# Edit .env — at minimum set KEY_CRIP_DATA

npm install

docker compose build
docker compose up -d py-server rb-server

npx tsx main.ts
```

Para executar tudo dentro do Docker (sem necessidade de Node.js local):

```bash
./scripts/docker-manage.sh build
./scripts/docker-manage.sh up
./scripts/docker-manage.sh cli
```

---

## Funcionalidades

| Modulo | Descricao |
|--------|-----------|
| Validacao de Email | Teste de credenciais SMTP com suporte a multiplas contas |
| Validacao de MongoDB | Validacao de connection string contra instancias ativas |
| Validacao de Supabase | Verificacao de URL + chave de API |
| Scraping do GitHub | Scraping de credenciais multi-bot com modo turbo (Puppeteer) |
| Criptografia de Bancos | AES-256-GCM + RSA-2048 ransomware para MySQL, PostgreSQL, MongoDB, Redis, Supabase, Firebase |
| C2 RAT | Agente Windows com shell remoto, transferencia de arquivos, captura de tela, bloqueio de input |
| Proxy Reverso | Filtragem de conteudo, sanitizacao de HTML, engines de bloqueio/substituicao |
| Monitoramento IMAP | Listener de caixa de entrada em tempo real com suporte a multiplas contas |
| Proxy Ambient | Proxy SOCKS Tor via Docker com maquina de estados de status |

---

## Arquitetura

```
                         AttackMenu Architecture

  +------------------+
  |  CLI (TS / Ink)  |  Interactive terminal UI
  |  :terminal       |  React components + Clean Architecture
  +--------+---------+
           |
           |  WebSocket
           |
     +-----+------+------------------+--------------------+
     |             |                  |                    |
     v             v                  v                    v
+---------+  +-----------+  +----------------+  +------------------+
| Python  |  |   Ruby    |  |   Compiler     |  |  Direct calls    |
| Server  |  | C2 Relay  |  |   (Docker)     |  |  SMTP, IMAP,     |
| :4445   |  | :4444     |  |   gcc/mingw    |  |  Mongo, Supabase |
+---------+  +-----------+  +----------------+  +------------------+
     |             |               |
     v             v               v
 Databases    C2 Agents       .exe / .elf
 (encrypt/    (Windows)       binaries
  decrypt)
```

**Comunicacao entre servicos:**

- **CLI --> Servidor Python** (`:4445`): WebSocket para comandos de criptografia/descriptografia de bancos de dados e gerenciamento de proxy reverso.
- **CLI --> Relay C2 Ruby** (`:4444`): WebSocket para comandos do operador C2 retransmitidos para agentes conectados.
- **CLI --> Compilador** (Docker efemero): Compila o agente C2 e o locker/decryptor de ransomware para Windows PE ou Linux ELF.
- **CLI --> Servicos externos**: Conexoes diretas SMTP, IMAP, MongoDB, Supabase para validacao de credenciais.

---

## Variaveis de Ambiente

| Variavel | Descricao | Obrigatoria |
|----------|-----------|-------------|
| `KEY_CRIP_DATA` | Chave de criptografia para operacoes de ransomware em bancos de dados | Sim (para modulo ransom) |
| `OPERATOR_TOKEN` | Token de autenticacao para o servidor relay C2 | Nao (vazio = acesso aberto) |
| `COOKIE_GIT0` | Cookie de sessao do GitHub para o bot scraper 0 | Nao |
| `COOKIE_GIT1` | Cookie de sessao do GitHub para o bot scraper 1 | Nao |
| `COOKIE_GIT2` | Cookie de sessao do GitHub para o bot scraper 2 | Nao |
| `PY_MANAGEMENT_PORT` | Porta do servidor WS Python (padrao: `4445`) | Nao |
| `PY_PROXY_PORT` | Porta do proxy reverso Python (padrao: `1212`) | Nao |
| `RB_WS_PORT` | Porta WebSocket do relay C2 Ruby (padrao: `4444`) | Nao |
| `RB_HTTP_PORT` | Porta da API HTTP do relay C2 Ruby (padrao: `8080`) | Nao |
| `DEBUG` | Habilitar logging de debug (padrao: `false`) | Nao |

---

## Comandos Docker

Toda a infraestrutura e gerenciada atraves de um unico script:

```bash
./scripts/docker-manage.sh <command>
```

| Comando | Descricao |
|---------|-----------|
| `build` | Compila todas as imagens Docker (py-server, rb-server, cli, compiler) |
| `up` | Inicia py-server + rb-server em background |
| `cli` | Executa a CLI interativamente dentro do Docker |
| `test` | Executa a suite completa de testes (TS + Python + Ruby + C) |
| `test-db` | Executa apenas testes de integracao de banco de dados |
| `test-c2` | Compila e testa o agente C2 no Wine |
| `test-ransom` | Compila e testa o locker de ransomware no Linux |
| `down` | Para todos os containers |
| `clean` | Remove todos os containers, volumes e imagens |
| `status` | Mostra o status dos containers |
| `logs` | Acompanha os logs do py-server e rb-server |

---

## Testes

O projeto possui quatro camadas de testes. Execute individualmente ou todos de uma vez:

```bash
# All tiers at once
./scripts/test-all.sh

# Or individually:

# TypeScript — unit, integration, shared (Vitest)
npx tsc --noEmit && npx vitest run

# Python — unit + integration (pytest)
python3 -m pytest tests-p/ -v --timeout=30

# Ruby — unit + integration (RSpec)
rspec tests-rb/ --format documentation

# C — OpenSSL crypto primitives
gcc -O2 compiler/ransom/tests/test_crypto.c -o /tmp/test_crypto -lssl -lcrypto
/tmp/test_crypto
```

Os testes TypeScript usam mocks nas fronteiras do dominio (validators, scrapers, engine factories). Os testes Python e Ruby incluem tanto testes unitarios quanto testes de integracao contra containers reais de banco de dados (gerenciados via `docker-compose.test.yml`).

---

## Estrutura do Projeto

```
attackmenu/
|-- main.ts                     Composition root + middleware global de erros
|-- package.json
|-- docker-compose.yml          Stack de producao
|-- docker-compose.test.yml     Bancos de teste + runners efemeros
|-- .env.example
|
|-- src/                        Core TypeScript (Clean Architecture)
|   |-- domain/
|   |   |-- entities/           EmailCredential, MongoCredential, Proxy, ...
|   |   |-- ports/              IEmailValidator, IC2Compiler, IRansomCompiler, ...
|   |   |-- commands/           ValidateEmailCommand, ImapStartListenCommand, ...
|   |   +-- patterns/           ICommandHandler, IMediator
|   |-- application/
|   |   |-- credential/         UseCases de ValidateEmail/Mongo/Supabase
|   |   |-- usecase/            MassiveValidationUseCase
|   |   |-- common/             ILogger, IValidator, LoggingBehavior
|   |   +-- DependencyInjection.ts
|   |-- infra/
|   |   |-- adapters/           Implementacoes concretas (SMTP, Docker, Puppeteer)
|   |   |-- engine/             CredentialEngine, CredentialEngineFactory
|   |   |-- controllers/        C2Controller, RansomController
|   |   +-- DependencyInjection.ts
|   |-- shared/                 Container (Token<T> DI), Result<T>, Observable<T>
|   +-- errors/                 DomainError, ConfigError, InfrastructureError
|
|-- public/                     Interface de terminal (React Ink)
|   |-- components/             App, HackerMenu, C2Window, RansomWindow, ...
|   |-- services/               ImapListenService, ProxyAmbientService, ...
|   |-- hooks/                  useObservable, useMouse, windowStore
|   +-- DependencyInjection.ts
|
|-- src-p/                      Servidor WS Python
|   |-- domain/                 Entidades, portas, servicos
|   |-- application/            Casos de uso
|   +-- infra/
|       +-- adapters/
|           |-- nosql/          MongoAdapter, RedisAdapter, FirebaseAdapter, SupabaseAdapter
|           +-- sql/            MySqlAdapter, PostgreSqlAdapter
|
|-- src-rb/                     Servidor relay C2 Ruby
|   |-- domain/                 Entidades, servicos
|   |-- adapters/               Drivers WebSocket, servidor HTTP
|   +-- ports/                  Contratos de entrada/saida
|
|-- compiler/
|   |-- c2/                     Agente RAT C++ Windows (cross-compile mingw)
|   +-- ransom/                 Locker + decryptor C (AES-256-GCM + RSA-2048)
|
|-- docker/
|   |-- cli/                    Dockerfile para container da CLI
|   |-- py-server/              Dockerfile para servidor Python
|   |-- rb-server/              Dockerfile para servidor Ruby
|   +-- compiler/               Dockerfile para compilador gcc/mingw
|
|-- tests/                      Testes TypeScript (Vitest)
|-- tests-p/                    Testes Python (pytest)
|-- tests-rb/                   Testes Ruby (RSpec)
|
|-- scripts/
|   |-- docker-manage.sh        Gerenciador de infraestrutura Docker
|   +-- test-all.sh             Executor completo de testes cross-tier
|
+-- viewer/                     Visualizador de logs HTML
```

---

## Aviso de Seguranca

Este software e destinado exclusivamente para testes de seguranca autorizados, engajamentos de red team e pesquisa educacional conduzidos com permissao escrita explicita do proprietario do sistema.

O uso nao autorizado desta ferramenta contra sistemas que voce nao possui ou nao tem permissao para testar e ilegal e antitico. Os autores nao assumem responsabilidade por uso indevido. Voce e o unico responsavel por garantir conformidade com todas as leis e regulamentacoes aplicaveis em sua jurisdicao.

---

## Licenca

ISC
