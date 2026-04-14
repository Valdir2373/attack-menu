# AttackMenu -- Documentacao de Arquitetura

Ultima atualizacao: 2026-04-10

---

## Sumario

1. [Visao Geral do Sistema](#1-visao-geral-do-sistema)
2. [Arquitetura de Camadas](#2-arquitetura-de-camadas)
3. [Container de Injecao de Dependencia](#3-container-de-injecao-de-dependencia)
4. [Protocolo de Comunicacao](#4-protocolo-de-comunicacao)
5. [Arquitetura de Criptografia de Banco de Dados](#5-arquitetura-de-criptografia-de-banco-de-dados)
6. [Arquitetura C2](#6-arquitetura-c2)
7. [Modelo de Seguranca](#7-modelo-de-seguranca)
8. [Padroes de Projeto](#8-padroes-de-projeto)

---

## 1. Visao Geral do Sistema

AttackMenu e um toolkit poliglota de seguranca ofensiva construido como uma
aplicacao de terminal UI. Tres runtimes colaboram por meio de canais WebSocket
e containers Docker:

- **TypeScript / React Ink** -- Frontend CLI e camada de orquestracao.
- **Python / asyncio** -- Servidor WebSocket para criptografia de banco de dados e operacoes de proxy.
- **Ruby / Sinatra + Thin** -- Servidor C2 relay para gerenciamento de agentes.
- **C / C++** -- Agentes compilados e payloads de ransomware (cross-compilados via Docker).

```
 User
  |
  |  stdin/stdout (React Ink terminal UI)
  |
 CLI  (TypeScript + React Ink)          port 4445                port 4444
  |                                   _____|_____              _____|_____
  |                                  |           |            |           |
  +--- ws ---- PythonWsClient ----->| Python WS |            | Ruby C2   |
  |                                 | Server    |            | Server    |
  |                                 |___________|            |___________|
  |                                      |                        |
  |                         +------------+--------+          +----+--------+
  |                         |            |        |          |    |        |
  |                    RansomDb     ProxyReverse  Conn    Mediator |     WsAdapter
  |                    Module      Module         Svc        |    |        |
  |                         |            |                   |    |        |
  |                  SQL/NoSQL      aiohttp           Handlers  Relay   Agents
  |                  Adapters       Target            Driver    (.exe)
  |                         |       Sites
  |                    Databases
  |
  +--- ws ---- C2RelayWsClient ---------------------------->| Ruby C2   |
  |                                                         | Server    |
  |
  +--------- Docker exec (child_process) -------> Compiler Containers
              |                                        |
              +-- C2CompilerService                    +-- vault.h + mingw
              |   vault.h + mingw-g++ --> c2_agent.exe |
              |                                        |
              +-- RansomCompilerService                +-- RSA keygen + gcc
                  RSA-2048 keygen + gcc/mingw          |   --> locker (linux)
                  --> locker_linux / locker_win.exe     +   --> locker_win.exe
```

### Responsabilidades por runtime

| Runtime    | Linguagem      | Porta | Responsabilidade                                      |
|------------|----------------|-------|-------------------------------------------------------|
| CLI        | TypeScript     | --    | UI, orquestracao, DI, validacao de credenciais, scraping |
| WS Server  | Python         | 4445  | Criptografia de banco de dados, reverse proxy, relay de agentes |
| C2 Server  | Ruby           | 4444  | Gerenciamento de agentes, relay de comandos, captura de tela |
| Compiler   | Docker (C/C++) | --    | Cross-compilacao de agentes e binarios de ransomware  |

---

## 2. Arquitetura de Camadas

Todos os tres runtimes seguem **Clean Architecture** com uma regra estrita de
dependencia unidirecional. A camada TypeScript possui a estrutura mais formal:

```
 Public (UI) -----> Application -----> Domain
                        ^
 Infrastructure --------+   (implements Domain and Application ports)
```

As setas sempre apontam para dentro. Nenhuma camada interna importa uma camada externa.

### 2.1 Domain (mais interna -- zero dependencias)

Localizacao: `src/domain/`

Contem a logica de negocio pura que nao possui conhecimento de bancos de dados,
frameworks ou mecanismos de transporte.

| Conceito        | Localizacao                 | Exemplos                                           |
|-----------------|-----------------------------|----------------------------------------------------|
| Entidades       | `entities/`                 | EmailCredential, MongoCredential, SupabaseCredential, ScrapingResult, Proxy |
| Value Objects   | `value-objects/`            | (reservado para EmailAddress, MongoUri quando necessario) |
| Portas          | `ports/`                    | IEmailValidator, IMongoValidator, ISupabaseValidator, IGitHubScraper, IProxyManager, IImapListener, IEmailMonitorService, IC2Compiler, IRansomCompiler, IPythonWsClient, IC2RelayClient |
| Commands        | `commands/`                 | ValidateEmailCommand, ImapStartListenCommand, StartReverseProxyCommand, ... |
| Patterns        | `patterns/`                 | ICommandHandler, IMediator                         |
| Regras de proxy | `proxy/reverse/`            | IBlockEngine, IReplaceEngine, IHtmlSanitizer, IRulesRepository, ProxyRules |

**Invariantes das entidades:**

Toda entidade usa um construtor privado com uma factory estatica `criar()` que
retorna `Result<T>`. Identidade (`id`) e `createdAt` sao gerados dentro da
factory.

```typescript
static criar(email: string, password: string): Result<EmailCredential> {
  if (!email || !email.includes("@")) return Result.fail("Email invalido");
  if (!password || password.length < 1) return Result.fail("Password nao pode ser vazio");
  return Result.ok(new EmailCredential(randomUUID(), email, password, new Date()));
}
```

A entidade Proxy usa uma maquina de estados finita para transicoes de ciclo de vida:

```
stopped --> starting --> running --> stopping --> stopped
               |            |           |
               +---> error <+-----------+
```

**Regras:**

- Sem bibliotecas externas.
- Sem ORMs, HTTP, logging ou referencias ao container de DI.
- Apenas logica de negocio pura e contratos de interface.

### 2.2 Application (orquestracao -- depende apenas do Domain)

Localizacao: `src/application/`

| Conceito        | Localizacao                       | Exemplos                                                 |
|-----------------|-----------------------------------|----------------------------------------------------------|
| Handlers        | `email/handlers/`, `mongo/handlers/`, `proxy/handlers/`, `scraping/handlers/` | ValidateEmailHandler, SendEmailHandler, StartAmbientProxyHandler |
| Use Cases       | `scraping/use-cases/`, `ransom/use-cases/`, `c2/use-cases/` | MassiveValidationUseCase, CompileRansomUseCase, CompileC2UseCase |
| DTOs            | `email/dto/`                      | EmailOutputDTO                                           |
| Validators      | `email/validators/`, `mongo/validators/`, `supabase/validators/` | ValidateEmailCommandValidator, ValidateMongoCommandValidator |
| Behaviours      | `common/`                         | LoggingBehavior, ValidationBehavior                      |
| Interfaces      | `common/`                         | ICredentialEngineFactory, ILogger, IValidator             |
| Controllers     | `email/`, `mongo/`, `proxy/`, `scraping/`, `ransom/`, `c2/` | IEmailController, IRansomController, IC2Controller |
| Mediator        | `common/Mediator.ts`              | Roteia commands para handlers via mapa de nomes de comando |
| Registro de DI  | `DependencyInjection.ts`          | Registra todos os handlers e use cases                   |

**Regras:**

- Sem SQL, sem chamadas HTTP diretas.
- Sem imports de `src/infra/`.
- Cada handler recebe suas dependencias pelo construtor.

### 2.3 Infrastructure (camada mais externa de implementacao -- depende de Application e Domain)

Localizacao: `src/infra/`

| Conceito        | Localizacao                       | Exemplos                                                 |
|-----------------|-----------------------------------|----------------------------------------------------------|
| Adaptadores de credencial | `adapters/credential/`  | EmailValidatorService, MongoValidatorService, SupabaseValidatorService |
| Scraping        | `adapters/scraping/`              | GitHubScraper                                            |
| Proxy           | `adapters/proxy/`                 | DockerProxyManagerService, reverse/ (Express, Block, Replace) |
| Monitoramento   | `adapters/monitoring/`            | ImapListenerService, EmailMonitorService                 |
| Email           | `adapters/email/`                 | ImapFlowClient, NodemailerEmailSender                    |
| Armazenamento   | `adapters/storage/`               | NodeFileStorage, KeywordFileReader                       |
| WebSocket       | `adapters/ws/`                    | PythonWsClient                                           |
| C2              | `adapters/c2/`                    | C2CompilerService, C2RelayWsClient                       |
| Ransom          | `adapters/ransom/`                | RansomCompilerService                                    |
| Engine          | `engine/`                         | CredentialEngine, CredentialEngineFactory                 |
| Controllers     | `controllers/`                    | EmailController, RansomController, C2Controller, ...     |
| Cross-cutting   | `cross-cutting/`                  | ChalkLogger                                              |
| Modulos         | `modules/`                        | ReverseProxyModule, ReverseProxyModuleFactory             |
| Registro de DI  | `DependencyInjection.ts`          | Registra todas as implementacoes concretas               |

### 2.4 Public (adaptador de entrada -- UI)

Localizacao: `public/`

| Conceito        | Localizacao                       | Exemplos                                                 |
|-----------------|-----------------------------------|----------------------------------------------------------|
| Componentes     | `components/`                     | App, HackerMenu, EmailWindow, C2Window, RansomWindow, ProxyWindow, ... |
| Services        | `services/`                       | ImapListenService, ProxyAmbientService, EmailSendService, ArtService |
| Hooks           | `hooks/`                          | useMouse, useObservable, windowStore                     |
| Contexto        | `services/ServicesContext.ts`     | useServices() para injecao nos componentes               |
| Registro de DI  | `DependencyInjection.ts`          | Token APP_SERVICES, addPublic()                          |
| Entrada CLI     | `cli.tsx`                         | renderCLI() recebe AppServices                           |

**Regra:** Sem imports de `src/infra/`.

### 2.5 Camadas da tier Python

Localizacao: `src-p/`

```
src-p/
  domain/
    service/        ISqlDialect, ISqlAdapter, INoSqlAdapter, IRansomCripEngine,
                    IDatabaseHealthCheck, ColumnData, SqlRansomDTO
  application/
    client/
      dto/          CommandInputDTO, CommandOutputDTO
      use_cases/    DispatchCommandUseCase
  infra/
    app/            AppModule (composition root and DI)
    adapters/
      sql/          BaseSqlAdapter, MySqlAdapter, PostgreSqlAdapter
      nosql/        MongoAdapter, FirebaseAdapter, SupabaseAdapter, RedisAdapter
    modules/        RansomDbModule, ProxyReverseModule
    service/        RansomCripEngine, SqlRansomIterator, DatabaseHealthChecker
    services/       ConnectionService
    controllers/    ClientController
    server/         WsServer
    utils/          Logger, Serializer
    database/       InMemoryDatabase
    repository/     InMemoryRepository
```

### 2.6 Camadas da tier Ruby

Localizacao: `src-rb/`

```
src-rb/
  domain/
    entities/       Machine, MachineStatus, FileBatch
    services/       MachineRegistry
  ports/
    input/          Commands (T::Struct value objects), CommandHandler (interface)
    output/         RelayPort (interface), AuthPort (interface)
  application/
    mediator.rb     Mediator (chain of responsibility dispatcher)
    handlers/       SetupHandler, FileHandler, ExecuteHandler
    observer/       MachineObserver
  adapters/
    drivers/        RelayDriver (implements RelayPort), TokenAuth (implements AuthPort)
    server/
      http/         HttpAdapter (endpoints REST)
      websocket/    WsAdapter (gerenciador de ciclo de vida WebSocket)
  main.rb           Composition root (aplicacao Sinatra com constantes)
```

---

## 3. Container de Injecao de Dependencia

### 3.1 Tipos fantasma Token<T>

O sistema de DI usa tipos fantasma para seguranca de tipos em tempo de compilacao.
Toda dependencia e identificada por uma instancia de `Token<T>`, e o container
infere o tipo de retorno a partir do token:

```typescript
// src/shared/Container.ts
export class Token<T> {
  declare readonly _type: T;   // phantom -- never assigned at runtime
  constructor(public readonly key: string) {}
}
```

### 3.2 Registro TOKENS

Todos os tokens residem em uma unica constante `TOKENS` em `src/shared/Container.ts`.
Esta e a fonte autoritativa de verdade para dependencias injetaveis:

```
TOKENS
  |-- Portas do Domain: ILogger, IGitHubScraper, IEmailValidator, IMongoValidator,
  |                     ISupabaseValidator, IProxyManager, IImapClient, IEmailSender,
  |                     IRansomCompiler, IC2Compiler, IPythonWsClient, IC2RelayClient
  |
  |-- Application:      IFileStorage, IClipboard, IKeywordReader,
  |                     ICredentialEngineFactory, IReverseProxyModuleFactory
  |
  |-- Transientes:      ImapListenerFactory, EmailMonitorServiceFactory
  |
  |-- Handlers:         ValidateEmailHandler, SendEmailHandler, FetchInboxHandler,
  |                     ValidateMongoHandler, StartAmbientProxyHandler, ... (25+ handlers)
  |
  |-- Use Cases:        MassiveValidationUseCase, CompileRansomUseCase, CompileC2UseCase
  |
  |-- Behaviours:       LoggingBehavior
  |
  |-- Mediator:         IMediator
  |
  |-- Controllers:      EmailController, MongoController, SupabaseController,
  |                     ProxyController, ProxyReverseController, ScraperController,
  |                     RansomController, C2Controller
```

### 3.3 Classe Container

```typescript
export class Container {
  private readonly _factories  = new Map<string, Factory<unknown>>();
  private readonly _singletons = new Map<string, unknown>();

  register<T>(token: Token<T>, factory: Factory<T>): this { ... }
  resolve<T>(token: Token<T>): T { ... }   // singleton -- cached after first call
}
```

`resolve()` e lazy-singleton: a factory executa na primeira resolucao e o
resultado e cacheado. Dependencias transientes (IMAP multi-conta, monitor de
email) sao tratadas registrando uma factory-de-factories:

```typescript
container.register(TOKENS.ImapListenerFactory, () => () => new ImapListenerService());
// resolve() retorna a factory externa (singleton)
// chamar a funcao retornada cria uma nova instancia a cada vez
```

### 3.4 Fluxo do Composition Root

Todo o sistema e inicializado em `main.ts`:

```
main.ts
  |
  |  1. dotenv.config()               -- carrega .env uma unica vez
  |  2. createContainer()             -- instancia vazia de Container
  |  3. addInfrastructure(container)  -- registra adaptadores concretos
  |  4. addApplication(container)     -- registra handlers, use cases, mediator
  |  5. addPublic(container)          -- monta AppServices, registra token APP_SERVICES
  |  6. renderCLI(container.resolve(APP_SERVICES))  -- inicia UI React Ink
  |
  +-- Middleware global de erro:
      process.on("uncaughtException")
      process.on("unhandledRejection")
      Hierarquia de erro: ConfigError | DomainError | InfrastructureError
```

O token `APP_SERVICES` reside em `public/DependencyInjection.ts` (e nao em
Container.ts) porque `AppServices` e um conceito da camada Public.

### 3.5 DI Python (AppModule)

A tier Python usa um padrao similar em `src-p/infra/app/AppModule.py`:

```
AppModule.__init__()
  |
  |  _bootstrap()
  |    _register_infra()        -- Logger, InMemoryDatabase
  |    _register_services()     -- ConnectionService
  |    _register_controllers()  -- ClientController
  |    _register_use_cases()    -- DispatchCommandUseCase
  |    _register_modules()      -- ProxyReverseModule, RansomDbModule (instala no dispatcher)
  |    _register_server()       -- WsServer
```

Mesmo padrao singleton-factory: dicionario `_factories` armazena lambdas,
dicionario `_singletons` cacheia instancias resolvidas.

### 3.6 Composicao Ruby (constantes)

A tier Ruby usa constantes como composition root em `src-rb/main.rb`:

```ruby
REGISTRY = Domain::Services::MachineRegistry.new
RELAY    = Adapters::Drivers::RelayDriver.new(registry: REGISTRY, ...)
AUTH     = Adapters::Drivers::TokenAuth.new(ENV.fetch("USER_TOKEN", ""))

SETUP_HANDLER   = Application::Handlers::SetupHandler.new(registry: REGISTRY, relay: RELAY)
FILE_HANDLER    = Application::Handlers::FileHandler.new(registry: REGISTRY, relay: RELAY)
EXECUTE_HANDLER = Application::Handlers::ExecuteHandler.new(registry: REGISTRY, relay: RELAY)

MEDIATOR = Application::Mediator.new(registry: REGISTRY, relay: RELAY)
MEDIATOR.add_handler(SETUP_HANDLER)
MEDIATOR.add_handler(FILE_HANDLER)
MEDIATOR.add_handler(EXECUTE_HANDLER)

OBSERVER = Application::Observer::MachineObserver.new(relay: RELAY)
WS_ADAPTER = Adapters::Server::Websocket::WsAdapter.new(...)
```

---

## 4. Protocolo de Comunicacao

### 4.1 TypeScript para Python (canal de gerenciamento)

Transporte: WebSocket na porta 4445 (configuravel via `MANAGEMENT_PORT`).

Cliente: `PythonWsClient` (`src/infra/adapters/ws/PythonWsClient.ts`)

**Formato da requisicao:**

```json
{
  "action": "ransom_db",
  "payload": {
    "db": "MongoDB",
    "mode": "single",
    "uri": "mongodb://user:pass@host:27017/db"
  }
}
```

**Formato da resposta:**

```json
{
  "success": true,
  "data": { "encrypted": 42, "db": "MongoDB", "uris_processed": 1 },
  "error": null,
  "event": "ransom_db_done"
}
```

**Eventos push** (iniciados pelo servidor, sem requisicao previa):

```json
{
  "success": true,
  "data": { "msg": "[+] 12 valor(es) criptografado(s)" },
  "event": "ransom_db_log"
}
```

**Fluxo de autenticacao:**

1. O cliente conecta em `ws://localhost:4445`.
2. Se `OPERATOR_TOKEN` estiver definido, o servidor espera que a primeira mensagem seja:
   `{ "action": "auth", "payload": { "token": "<token>" } }`
3. O servidor valida usando `hmac.compare_digest` (comparacao em tempo constante).
4. Em caso de sucesso, o servidor envia: `{ "event": "connected", "data": { "client_id": "..." } }`

**Politica de retry:**

`PythonWsClient.send()` tenta ate 3 vezes com 1s de delay entre tentativas.
Cada tentativa tem um timeout de resposta de 10s. O estabelecimento de conexao tem timeout de 5s.

**Acoes conhecidas:**

| Acao           | Modulo           | Descricao                             |
|----------------|------------------|---------------------------------------|
| `ransom_db`    | RansomDbModule   | Criptografar valores do banco de dados |
| `proxy_start`  | ProxyReverseModule | Iniciar reverse proxy via aiohttp   |
| `proxy_stop`   | ProxyReverseModule | Parar reverse proxy                 |
| Acoes do cliente | ClientController | Gerenciamento de conexao            |

### 4.2 TypeScript para Ruby (canal C2)

Transporte: WebSocket na porta 4444 (configuravel via Sinatra/Thin).

Cliente: `C2RelayWsClient` (`src/infra/adapters/c2/C2RelayWsClient.ts`)

**Handshake de conexao:**

A primeira mensagem apos a abertura do WebSocket determina o papel do cliente:

```
 Client                          Ruby Server
   |                                  |
   |--- { type: "operator",     ---->| role = :operator
   |      token: "..." }             | validates via secure_compare
   |                                  |
   |<-- { type: "welcome",     ------|
   |      machines: [...] }          |
```

```
 Agent (.exe)                    Ruby Server
   |                                  |
   |--- { type: "register",    ---->| role = :agent
   |      name: "PC-01",            | creates Machine entity
   |      os: "Windows 10",         | registers in MachineRegistry
   |      ip: "10.0.0.5" }          |
   |                                  |
   |<-- { type: "registered",  ------|
   |      id: "a1b2c3d4" }          |
```

```
 Viewer                          Ruby Server
   |                                  |
   |--- { type: "viewer",      ---->| role = :viewer
   |      machine_id: "a1b2c3d4" }  | added to viewers set for that machine
   |                                  |
   |<-- { type: "viewer_ok",   ------|
   |      machine_id: "a1b2c3d4" }  |
```

**Comandos do operador (TS -> Ruby -> Agent):**

| Tipo de comando  | Campos do payload                 | Descricao                     |
|------------------|-----------------------------------|-------------------------------|
| `list_machines`  | (nenhum)                          | Listar agentes conectados     |
| `cmd`            | `machine_id`, `command`           | Executar comando shell        |
| `file_list`      | `machine_id`, `path`              | Listar conteudo do diretorio  |
| `file_download`  | `machine_id`, `path`              | Baixar arquivo do agente      |
| `file_upload`    | `machine_id`, `path`, `data`      | Enviar arquivo para o agente (base64) |
| `file_exec`      | `machine_id`, `path`              | Executar arquivo enviado      |
| `block_input`    | `machine_id`, `target`            | Bloquear teclado/mouse        |
| `unblock_input`  | `machine_id`, `target`            | Desbloquear teclado/mouse     |
| `screen_start`   | `machine_id`, `fps`               | Iniciar stream de captura de tela |
| `screen_stop`    | `machine_id`                      | Parar captura de tela         |

**Eventos push (Ruby -> TS):**

| Tipo de evento          | Origem  | Descricao                                |
|-------------------------|---------|------------------------------------------|
| `machine_connected`     | Servidor | Novo agente registrado                  |
| `machine_disconnected`  | Servidor | Agente desconectado                     |
| `machines`              | Servidor | Resposta com lista completa de maquinas |
| `cmd_result`            | Agente  | Saida do comando shell                   |
| `file_list_result`      | Agente  | Listagem do diretorio                    |
| `file_data`             | Agente  | Dados do arquivo baixado (base64)        |
| `file_upload_result`    | Agente  | Confirmacao de upload                    |
| `file_exec_result`      | Agente  | Resultado da execucao                    |
| `input_status`          | Agente  | Confirmacao de bloqueio/desbloqueio de entrada |
| `screen_frame`          | Agente  | Frame JPEG (base64), roteado para viewers |
| `error`                 | Servidor | Mensagem de erro                        |

---

## 5. Arquitetura de Criptografia de Banco de Dados

O subsistema de criptografia de banco de dados reside na tier Python e criptografa
valores do banco de dados in-place usando AES-256-GCM.

### 5.1 Visao geral do fluxo

```
 CLI (RansomWindow)
  |
  |  { action: "ransom_db", payload: { db, mode, uri } }
  |
  v
 PythonWsClient --ws--> WsServer --> DispatchCommandUseCase
                                          |
                                    RansomDbModule._handle_ransom_db()
                                          |
                         +----------------+------------------+
                         |                                   |
                   _run_sql(db, uri)                  _run_nosql(db, uri)
                         |                                   |
              +----------+----------+              +---------+---------+
              |                     |              |         |         |
         MySqlAdapter      PostgreSqlAdapter   MongoAdapter  Firebase  Redis
              |                     |              |       Adapter   Adapter
              v                     v              v
         BaseSqlAdapter        BaseSqlAdapter   INoSqlAdapter
              |                     |              |
         ISqlDialect           ISqlDialect     list_records()
         (Strategy)            (Strategy)          |
              |                     |              v
              v                     v        RansomCripEngine
         get_columns()         get_columns()  .execute(write_fn, records)
              |                     |              |
              v                     v              v
         ColumnData[]          ColumnData[]   AES-256-GCM per value
              |                     |              |
              v                     v              v
         SqlRansomIterator     SqlRansomIterator  write_fn() --> overwrite()
              |                     |
              v                     v
         RansomCripEngine      RansomCripEngine
         .execute(write_fn,    .execute(write_fn,
                  values)               values)
              |                     |
              v                     v
         write_fn() -->        write_fn() -->
         UPDATE per cell       UPDATE per cell
```

### 5.2 Sistema de health check

Antes de criptografar, o modulo executa um health check:

```
 RansomDbModule
  |
  get_health_checker(db)
  |
  +--> MongoHealthChecker     -- pymongo ping
  +--> MySqlHealthChecker     -- pymysql connect + ping
  +--> PostgresHealthChecker  -- psycopg2 SELECT 1
  +--> RedisHealthChecker     -- redis-py ping
  +--> FirebaseHealthChecker  -- HTTP GET /.json?shallow=true
  +--> SupabaseHealthChecker  -- HTTP GET /rest/v1/data?select=id&limit=0
  |
  v
  DbDiagnostic { status, message, can_reactivate, reactivate_hint, raw_error }
  |
  DbStatus enum:
    HEALTHY     -- prosseguir com criptografia
    INACTIVE    -- cluster pausado (Atlas/Supabase), oferecer dica de reativacao
    BAD_CREDS   -- credenciais invalidas, pular
    UNREACHABLE -- problema de rede/firewall, pular
    OVERLOADED  -- conexoes demais, pular
    READ_ONLY   -- modo somente leitura (Redis MISCONF), pular
    ERROR       -- erro inesperado, pular
```

### 5.3 Polimorfismo SQL (padrao Strategy)

A interface `ISqlDialect` abstrai diferencas de SQL entre MySQL e PostgreSQL:

```
 ISqlDialect (abstract)
  |
  +-- connect(uri)
  +-- execute(query, params)
  +-- fetch_all(query, params)
  +-- fetch_one(query, params)
  +-- commit()
  +-- quote_identifier(name)         -- backticks vs double quotes
  +-- get_column_type_query(table)   -- INFORMATION_SCHEMA query
  +-- get_pk_query()                 -- descoberta de chave primaria
  +-- alter_column_to_text(table, column)  -- ALTER para preparar criptografia
  +-- needs_text_conversion(data_type)     -- verificacao de compatibilidade de tipo
  +-- begin_transaction(table)
  +-- end_transaction()
  +-- build_update(table, column, pk_column, pk_value)
```

`BaseSqlAdapter` usa o dialeto para:

1. Descobrir a coluna de chave primaria.
2. Buscar tipos de colunas no INFORMATION_SCHEMA.
3. ALTER de colunas nao-texto para TEXT (habilitando armazenamento hex do texto cifrado).
4. Ler todos os valores por coluna.
5. Construir objetos `ColumnData` com uma closure `write_fn` para UPDATEs por celula.

### 5.4 Motor de criptografia

`RansomCripEngine` usa AES-256-GCM via a biblioteca `cryptography`:

```
 Input: plaintext value (any type, serialized to bytes)
                     |
                     v
 KEY_CRIP_DATA env var --> SHA-256 --> 32-byte key
                     |
                     v
 os.urandom(12) --> nonce (12 bytes)
                     |
                     v
 AESGCM.encrypt(nonce, plaintext, None)
                     |
                     v
 Output: nonce (12B) || ciphertext || tag (16B)
         stored as hex string via write_fn()
```

---

## 6. Arquitetura C2

### 6.1 Topologia do sistema

```
 Operator (CLI)                  Ruby C2 Server (:4444)               Agent (.exe)
 +------------+                  +-------------------+                +-----------+
 | C2Window   |                  | WsAdapter         |                | c2_agent  |
 | C2Relay    |--- ws:4444 ----->| role detection    |<--- ws:4444 --| register  |
 | WsClient   |                  |                   |                |           |
 +------------+                  | Mediator          |                | Win32 API |
                                 |  SetupHandler     |                | GDI+      |
                                 |  FileHandler      |                | WinSock2  |
 Viewer                          |  ExecuteHandler   |                +-----------+
 +------------+                  |                   |
 | Screen     |--- ws:4444 ----->| MachineRegistry   |
 | component  |  (viewer role)   | MachineStatus     |
 +------------+                  | MachineObserver   |
                                 | RelayDriver       |
                                 +-------------------+
```

### 6.2 Fluxo de registro do agente

```
 1. O agente conecta em ws://server:4444
 2. O agente envia:  { type: "register", name: "DESKTOP-01", os: "Windows 10", ip: "10.0.0.5" }
 3. O servidor cria uma entidade Machine com id SecureRandom.hex(8)
 4. O servidor registra a maquina no MachineRegistry
 5. O servidor cria MachineStatus e MachineObserver observa
 6. O servidor responde: { type: "registered", id: "a1b2c3d4e5f6g7h8" }
 7. O servidor transmite para todos os operadores: { type: "machine_connected", machine: {...} }
```

### 6.3 Despacho de comandos (Chain of Responsibility)

O Mediator Ruby usa o padrao chain-of-responsibility:

```
 Mensagem do operador
  |
  v
 WsAdapter.parse_operator_command(type, msg)
  |
  v
 Objeto Command (value object T::Struct)
  |
  v
 Mediator.dispatch(command, context)
  |
  +---> SetupHandler.handle(command, context)    -- BlockInput, UnblockInput
  |     retorna true se tratou
  |
  +---> FileHandler.handle(command, context)     -- FileList, FileDownload, FileUpload, FileExec
  |     retorna true se tratou
  |
  +---> ExecuteHandler.handle(command, context)  -- ExecuteShell, ScreenStart, ScreenStop
  |     retorna true se tratou
  |
  +---> Mediator fallback                        -- ListMachines (built-in)
```

Cada handler retorna `true` se consumiu o comando, interrompendo a cadeia.
O mediator valida a existencia do `machine_id` antes de despachar.

### 6.4 Transferencia de arquivos (maquina de estados FileBatch)

```
 :idle --> :transferring --> :completed
               |
               +--> :failed
```

A entidade `FileBatch` rastreia o progresso da transferencia:

```ruby
FileBatch.new(machine_id:, filename:, total_size:, direction:)
  .start!       # idle -> transferring
  .progress!(n) # accumulate bytes
  .complete!    # transferring -> completed
  .fail!(reason)# any -> failed
  .percentage   # (transferred / total_size * 100).round(1)
```

`safe_transition(target, bytes:, reason:)` fornece uma alternativa que nao
lanca excecao para atualizacoes concorrentes.

### 6.5 Captura de tela

O agente C2 (c2_agent.cpp) captura a tela usando Windows GDI+:

```
 Agent (Windows)                            Server                    Viewer
  |                                           |                         |
  | <-- { type: "screen_start", fps: 5 } --- |                         |
  |                                           |                         |
  | [thread de captura inicia]                |                         |
  |  BitBlt(hdcMem, hdcScreen)                |                         |
  |  GDI+ JPEG encode (quality 50)            |                         |
  |  base64 encode                            |                         |
  |                                           |                         |
  | --- { type: "screen_frame",          ---> |                         |
  |       data: "<base64 JPEG>" }             |                         |
  |                                           | --- screen_frame -----> |
  |                                           |    (roteado para viewers|
  |                                           |     desta maquina)      |
  |                                           |                         |
  | <-- { type: "screen_stop" }          --- |                         |
  | [thread de captura para]                  |                         |
```

Frames de tela NAO sao transmitidos para operadores -- sao roteados exclusivamente
para WebSockets de viewers inscritos no machine_id especifico.

### 6.6 Compilacao do agente

O `C2CompilerService` compila um executavel Windows via Docker:

```
 1. Criar pasta de build: compiler/c2/builds/<timestamp>/
 2. Parsear URL do servidor em host, porta, path
 3. Gerar vault.h:
      #define SERVER_HOST "10.0.0.1"
      #define SERVER_PORT 4444
      #define SERVER_PATH "/"
 4. Copiar c2_agent.cpp para a pasta de build
 5. Docker run:
      c2-compiler (debian:bookworm-slim + mingw-w64)
      x86_64-w64-mingw32-g++ -O2 -s -std=c++17 c2_agent.cpp -o c2_agent.exe
      -lgdi32 -lgdiplus -lole32 -luuid -lws2_32 -luser32 -lkernel32 -lwinpthread
      -static-libgcc -static-libstdc++
 6. Retornar Result<{ binaryPath, buildId }>
```

---

## 7. Modelo de Seguranca

### 7.1 Criptografia

**Binario de ransomware (locker):**

```
 RSA-2048-OAEP + AES-256-GCM (hybrid encryption)

 Tempo de build (RansomCompilerService):
   generateKeyPairSync("rsa", { modulusLength: 2048 })
   Public key DER --> embutida em vault.h como array de bytes C
   Private key PEM --> salva em builds/<id>/private_key.pem

 Se RANSOM_MASTER_KEY estiver definida (hex de 32 bytes):
   Private key PEM e criptografada com AES-256-GCM:
     iv (12B) || tag (16B) || ciphertext
   Salva como private_key.pem.enc

 Runtime (binario locker):
   Cada arquivo: chave AES-256-GCM aleatoria --> criptografar arquivo
   Chave AES criptografada com chave publica RSA-2048-OAEP
   Armazenada junto ao texto cifrado
   Descriptografia requer a private key PEM
```

**Criptografia de banco de dados (RansomCripEngine):**

```
 AES-256-GCM por valor
   Chave: SHA-256(KEY_CRIP_DATA env var) --> 32 bytes
   Nonce: os.urandom(12) por valor
   Saida: nonce || ciphertext || tag (armazenado como hex)
```

### 7.2 Autenticacao

| Canal              | Mecanismo                    | Implementacao                           |
|--------------------|------------------------------|-----------------------------------------|
| Python WS (:4445)  | Token HMAC                   | `hmac.compare_digest(token, expected)`  |
| Ruby C2 (:4444)    | Rack secure_compare          | `Rack::Utils.secure_compare(expected, token)` |
| Origem do token    | Variavel de ambiente         | `OPERATOR_TOKEN` (Python), `USER_TOKEN` (Ruby) |
| Token vazio        | Autenticacao desabilitada    | Ambos os servidores permitem todas as conexoes |

Ambas as implementacoes usam comparacao em tempo constante para prevenir ataques de timing.

### 7.3 Gerenciamento de chaves

| Chave              | Proposito                         | Armazenamento    |
|--------------------|-----------------------------------|------------------|
| `RANSOM_MASTER_KEY`| Criptografar PEM da chave privada RSA | `.env` (64 hex) |
| `KEY_CRIP_DATA`    | Derivar chave AES para criptografia de BD | `.env`     |
| `OPERATOR_TOKEN`   | Autenticacao do WS Python         | `.env`           |
| `USER_TOKEN`       | Autenticacao do C2 Ruby           | `.env`           |
| `COOKIE_GIT*`      | Sessao de scraping do GitHub      | `.env`           |

### 7.4 Seguranca Docker

Containers de compilacao rodam com privilegios minimos:

- Flag `--rm`: container removido apos compilacao.
- Volume montado limitado a pasta de build especifica.
- Sem shell na execucao de producao (Dockerfile do ransom usa `/bin/bash` como CMD padrao,
  mas o servico TypeScript sobrescreve com argumentos explicitos do compilador).
- Base debian bookworm-slim: superficie de ataque minima.

### 7.5 Seguranca de credenciais

- Credenciais nunca sao logadas por completo. A funcao `_mask()` trunca URIs em 24 caracteres.
- `.gitignore` cobre `.env`, `*.cookies`, `output/`, `temp/`, `builds/`.
- Acesso a `process.env` e restrito a `src/config/` (tier TypeScript).

---

## 8. Padroes de Projeto

| Padrao                    | Onde                               | Proposito                                        |
|---------------------------|------------------------------------|-------------------------------------------------|
| Result\<T\>               | Todas as tiers (TS)               | Tratamento explicito de erros sem excecoes para falhas esperadas |
| Observable\<T\>           | `src/shared/Observable.ts`, Proxy | Atualizacoes reativas de estado push-based para a UI |
| Chain of Responsibility   | Ruby `Mediator` + handlers        | Roteamento de comandos por cadeia ordenada de handlers |
| State Machine             | Entidade `Proxy`, entidade `FileBatch` | Gerenciamento de ciclo de vida com transicoes validadas |
| Factory                   | Container de DI, `CredentialEngineFactory`, `ReverseProxyModuleFactory` | Criacao lazy de dependencias e instancias transientes |
| Strategy                  | `ISqlDialect` (MySQL vs PostgreSQL) | Polimorfismo de dialeto SQL para operacoes de banco |
| Memento                   | `SetupHandler.InputMemento`       | Backup e restauracao do estado de bloqueio de entrada por maquina |
| Observer                  | `MachineStatus`, `MachineObserver` | Notificacoes em tempo real sobre mudancas de estado de maquinas |
| Mediator                  | TS `Mediator`, Ruby `Mediator`    | Roteamento desacoplado de comando para handler   |
| Command                   | `commands/` (TS), `commands.rb`   | Intencao encapsulada como value objects          |
| Adapter                   | Todos os diretorios `adapters/`   | Ponte entre portas do domain e sistemas externos |
| Composition Root          | `main.ts`, `AppModule.py`, `main.rb` | Ponto unico de ligacao de dependencias        |
| Singleton (por container) | Container.resolve()               | Uma instancia por token por tempo de vida do container |
| Phantom Type              | `Token<T>`                        | Inferencia de tipos em tempo de compilacao para resolucao de DI |
| Behaviour (Decorator)     | `LoggingBehavior`, `ValidationBehavior` | Preocupacoes transversais compostas ao redor de handlers |

### Interacao entre padroes

```
 Command (value object)
  |
  v
 Mediator.send(command)
  |
  +--> ValidationBehavior.execute(command)   -- valida invariantes
  |         |
  |         v
  +--> LoggingBehavior.execute(command)      -- loga entrada/saida
  |         |
  |         v
  +--> Handler.execute(command)              -- logica de negocio
            |
            v
       Port (interface) --> Adapter (implementacao)
            |
            v
       Result<T>  -- retornado ao chamador
```

---

## Apendice A: Hierarquia de Erros (TypeScript)

```
 Error (built-in)
  |
  +-- DomainError (abstract)
  |     +-- NotFoundError
  |     +-- InvalidCommandError
  |
  +-- ConfigError
  |
  +-- InfrastructureError
```

- `DomainError`: violacoes de regras de negocio.
- `NotFoundError`: recurso nao encontrado.
- `InvalidCommandError`: comando malformado.
- `ConfigError`: variavel de ambiente ou configuracao ausente.
- `InfrastructureError`: falha tecnica (banco de dados, rede, Docker).

`Result<T>` e usado para falhas de negocio esperadas. `throw` e reservado para
situacoes irrecuperaveis. O middleware global em `main.ts` captura todas as
excecoes nao tratadas e rejeicoes nao tratadas.

---

## Apendice B: Resumo de Portas

| Porta | Protocolo | Servico                | Direcao                |
|-------|-----------|------------------------|------------------------|
| 4444  | WebSocket | Servidor C2 relay Ruby | Agentes, operadores, viewers conectam |
| 4445  | WebSocket | Servidor de gerenciamento Python | CLI TS conecta  |
| --    | Docker    | Containers de compilacao | CLI TS inicia via `docker run --rm` |

---

## Apendice C: Bancos de Dados Suportados (Criptografia)

| Banco de Dados | Tipo de Adaptador | Health Checker         | Caminho de Criptografia          |
|----------------|-------------------|------------------------|----------------------------------|
| MongoDB        | NoSQL             | MongoHealthChecker     | MongoAdapter.list_records + overwrite |
| Firebase       | NoSQL             | FirebaseHealthChecker  | FirebaseAdapter                  |
| Supabase       | REST/NoSQL        | SupabaseHealthChecker  | SupabaseAdapter                  |
| Redis          | REST/NoSQL        | RedisHealthChecker     | RedisAdapter                     |
| MySQL          | SQL               | MySqlHealthChecker     | BaseSqlAdapter + MySqlDialect    |
| PostgreSQL     | SQL               | PostgresHealthChecker  | BaseSqlAdapter + PostgreSqlDialect |
