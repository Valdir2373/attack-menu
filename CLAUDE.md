# CLAUDE.md — Arquitetura, Padrões e Regras do Projeto AttackMenu

Você é um arquiteto de software sênior. Toda alteração de código, criação de arquivo ou sugestão deve obedecer este documento. Sem exceções.

O projeto está em `D:\programming\menu`. Compila com `npx tsc --noEmit`. Testes rodam com `npx vitest run`. **Não quebre nenhum dos dois em nenhum momento.**

---

## 1. ARQUITETURA DE CAMADAS

Dependência unidirecional: **Infra → Application → Domain**. Public é adaptador de entrada.

```
Public (UI) ──→ Application ──→ Domain
                    ↑
Infrastructure ─────┘  (implementa portas do Domain e da Application)
```

**Regra:** setas apontam sempre para dentro. Nenhuma camada interna importa uma camada externa.

### Domain (Núcleo — não depende de nada)

- **Entidades** com identidade única, construtor privado, factory `criar()` retornando `Result<T>`, validação de invariantes.
- **Value Objects** imutáveis com validação no `criar()` (pasta `value-objects/` — usar quando necessário).
- **Portas** (interfaces) em `ports/` — contratos do que o sistema precisa: `IEmailValidator`, `IMongoValidator`, `ISupabaseValidator`, `IGitHubScraper`, `IProxyManager`, `IImapListener`, `IEmailMonitorService`.
- **Commands** — objetos de intenção (`ValidateEmailCommand`, `ImapStartListenCommand`, etc.).
- **Patterns** — `ICommandHandler`, `IMediator` (contratos genéricos).
- **PROIBIDO:** bibliotecas externas, ORMs, referências a banco, HTTP, log, `IDependencyContainer`, ou qualquer detalhe técnico.

### Application (Orquestradora — depende apenas do Domain)

- **Use Cases** magros (um por caso de uso): `ValidateEmailUseCase`, `ValidateMongoUseCase`, `ValidateSupabaseUseCase`, `MassiveValidationUseCase`.
- **DTOs** de entrada e saída.
- **Behaviours** composáveis: `LoggingBehavior`, `ValidationBehavior`.
- **Interfaces de orquestração**: `ICredentialEngineFactory`, `IReverseProxyModuleFactory`, `ILogger`, `IValidator`.
- `DependencyInjection.ts` — registra use cases no container.
- **PROIBIDO:** SQL, chamadas HTTP diretas, imports de `src/infra/`.

### Infrastructure (Casca externa)

- **Adapters** que implementam as portas do Domain, organizados em:
  - `adapters/credential/` — `EmailValidatorService`, `MongoValidatorService`, `SupabaseValidatorService`
  - `adapters/scraping/` — `GitHubScrapper`
  - `adapters/proxy/` — `DockerProxyManagerService` + `reverse/` (Express, Block, Replace, etc.)
  - `adapters/monitoring/` — `ImapListenerService`, `EmailMonitorService`
- **Engine** — `CredentialEngine`, `CredentialEngineFactory`.
- **CrossCutting** — `ChalkLogger` (implementa `ILogger`).
- **Modules** — `ReverseProxyModule`, `ReverseProxyModuleFactory`.
- `DependencyInjection.ts` — registra implementações concretas.
- **NÃO EXISTEM:** `SimpleDependencyContainer`, `HandlerRegistry`, `EmailMediator`, mini-containers dentro de módulos. Foram eliminados na refatoração.

### Public (Adaptador de entrada — UI)

- Menu INK, componentes React/Ink em `components/`.
- Services em `services/` — recebem deps via construtor (nunca instanciam Infra).
- `ServicesContext.ts` com `useServices()` para injeção nos componentes.
- `DependencyInjection.ts` — monta `AppServices` a partir dos tokens do container. Define `APP_SERVICES` token.
- **PROIBIDO:** qualquer import de `src/infra/`.

---

## 2. ENTIDADES DO DOMÍNIO (IMPLEMENTADAS)

Todas em `src/domain/entities/` com construtor privado, factory estática `criar()` retornando `Result<T>`, e `id` + `createdAt` gerados internamente.

### EmailCredential

```typescript
// src/domain/entities/EmailCredential.ts
export class EmailCredential {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly password: string,
    public readonly createdAt: Date,
  ) {}

  static criar(email: string, password: string): Result<EmailCredential> {
    if (!email || !email.includes("@")) return Result.fail("Email inválido");
    if (!password || password.length < 1)
      return Result.fail("Password não pode ser vazio");
    return Result.ok(
      new EmailCredential(randomUUID(), email, password, new Date()),
    );
  }
}
```

### MongoCredential

```typescript
static criar(uri: string): Result<MongoCredential> {
  if (!uri || !uri.startsWith("mongodb")) return Result.fail("URI MongoDB inválida");
  return Result.ok(new MongoCredential(randomUUID(), uri, new Date()));
}
```

### SupabaseCredential

```typescript
static criar(url: string, key: string): Result<SupabaseCredential> {
  if (!url || !url.includes("supabase")) return Result.fail("URL Supabase inválida");
  if (!key || key.length < 10) return Result.fail("Key Supabase inválida");
  return Result.ok(new SupabaseCredential(randomUUID(), url, key, new Date()));
}
```

### ScrapingResult

```typescript
static criar(keyword: string, repository: string): Result<ScrapingResult> {
  if (!keyword) return Result.fail("Keyword não pode ser vazia");
  if (!repository) return Result.fail("Repository não pode ser vazio");
  return Result.ok(new ScrapingResult(randomUUID(), keyword, repository, new Date()));
}
```

### Proxy (modelo com máquina de estados — sem persistência)

```typescript
export type ProxyStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export class Proxy {
  private _status: ProxyStatus = "stopped";
  private _port: number = 0;
  private _containerName: string = "";

  transitionTo(
    status: ProxyStatus,
    info?: { port?: number; containerName?: string },
  ): Result<void> {
    const validTransitions: Record<ProxyStatus, ProxyStatus[]> = {
      stopped: ["starting"],
      starting: ["running", "error"],
      running: ["stopping", "error"],
      stopping: ["stopped", "error"],
      error: ["starting", "stopped"],
    };
    if (!validTransitions[this._status]?.includes(status)) {
      return Result.fail(`Transição inválida: ${this._status} → ${status}`);
    }
    this._status = status;
    if (info?.port) this._port = info.port;
    if (info?.containerName) this._containerName = info.containerName;
    return Result.ok(undefined);
  }
}
```

**Nota:** `Email.ts` (about, from, content) ainda existe como DTO de email recebido pelo IMAP — não é entidade DDD.

---

## 3. CONTAINER DE DI — TOKEN<T> TYPE-SAFE

O container usa **phantom types** para inferência automática de tipos. Não existe mais `resolve<T>("string")` — o tipo é inferido pelo token.

### Token<T>

```typescript
// src/shared/Container.ts
export class Token<T> {
  declare readonly _type: T;
  constructor(public readonly key: string) {}
}
```

### TOKENS — fonte única de verdade para src/

```typescript
export const TOKENS = {
  // Domain ports
  ILogger: new Token<ILogger>("ILogger"),
  IGitHubScraper: new Token<IGitHubScraper>("IGitHubScraper"),
  IEmailValidator: new Token<IEmailValidator>("IEmailValidator"),
  IMongoValidator: new Token<IMongoValidator>("IMongoValidator"),
  ISupabaseValidator: new Token<ISupabaseValidator>("ISupabaseValidator"),
  IProxyManager: new Token<IProxyManager>("IProxyManager"),
  ICredentialEngineFactory: new Token<ICredentialEngineFactory>(
    "ICredentialEngineFactory",
  ),
  IReverseProxyModuleFactory: new Token<IReverseProxyModuleFactory>(
    "IReverseProxyModuleFactory",
  ),

  // Transient factories
  ImapListenerFactory: new Token<() => IImapListener>("ImapListenerFactory"),
  EmailMonitorServiceFactory: new Token<() => IEmailMonitorService>(
    "EmailMonitorServiceFactory",
  ),

  // Application use cases
  LoggingBehavior: new Token<LoggingBehavior>("LoggingBehavior"),
  ValidateEmailUseCase: new Token<ValidateEmailUseCase>("ValidateEmailUseCase"),
  ValidateMongoUseCase: new Token<ValidateMongoUseCase>("ValidateMongoUseCase"),
  ValidateSupabaseUseCase: new Token<ValidateSupabaseUseCase>(
    "ValidateSupabaseUseCase",
  ),
  MassiveValidationUseCase: new Token<MassiveValidationUseCase>(
    "MassiveValidationUseCase",
  ),
} as const;
```

### Container

```typescript
export class Container {
  private readonly _factories  = new Map<string, Factory<unknown>>();
  private readonly _singletons = new Map<string, unknown>();

  register<T>(token: Token<T>, factory: Factory<T>): this { ... }
  resolve<T>(token: Token<T>): T { ... }  // singleton — cacheia após 1ª chamada
}
```

### APP_SERVICES — token da camada Public

O token `APP_SERVICES` vive em `public/DependencyInjection.ts` (não em `src/shared/Container.ts`) porque `AppServices` é conceito da camada Public e está fora do `rootDir` do TypeScript.

```typescript
// public/DependencyInjection.ts
export const APP_SERVICES = new Token<AppServices>("AppServices");
```

### Como adicionar nova dependência:

1. Crie interface (porta) no Domain (`src/domain/ports/`) ou Application (`src/application/common/`).
2. Crie implementação na Infra (`src/infra/adapters/[contexto]/`).
3. Adicione o `Token<T>` em `TOKENS` no `Container.ts` (com import type).
4. Registre no `src/infra/DependencyInjection.ts`.
5. Se a Application precisa, resolva no `src/application/DependencyInjection.ts`.
6. Se o Public precisa, adicione ao `AppServices` e registre no `public/DependencyInjection.ts`.

### Factories transientes (multi-account):

```typescript
container.register(
  TOKENS.ImapListenerFactory,
  () => () => new ImapListenerService(),
);
// Cada chamada de resolve retorna a mesma factory; cada chamada da factory cria nova instância.
```

---

## 4. COMPOSITION ROOT (main.ts)

```typescript
#!/usr/bin/env node
import { config } from "dotenv";
config();

import { createContainer } from "./src/shared/Container.js";
import { addInfrastructure } from "./src/infra/DependencyInjection.js";
import { addApplication } from "./src/application/DependencyInjection.js";
import { addPublic, APP_SERVICES } from "./public/DependencyInjection.js";
import { renderCLI } from "./public/cli.js";
import { DomainError } from "./src/errors/index.js";
import { ConfigError } from "./src/errors/index.js";
import { InfrastructureError } from "./src/errors/index.js";

// ── Middleware global de erro ────────────────────────────────────────────
function handleFatalError(err: unknown): never {
  if (err instanceof ConfigError) {
    console.error(`[Config] ${err.message}`);
    console.error("Verifique as variáveis de ambiente no arquivo .env");
  } else if (err instanceof DomainError) {
    console.error(`[Domain] ${err.message}`);
  } else if (err instanceof InfrastructureError) {
    console.error(`[Infra] ${err.message}`);
    if (err.cause) console.error(`  Causa: ${err.cause.message}`);
  } else if (err instanceof Error) {
    console.error(`[Fatal] ${err.message}`);
  } else {
    console.error("[Fatal] Erro desconhecido:", err);
  }
  process.exit(1);
}

process.on("uncaughtException", (err) => handleFatalError(err));
process.on("unhandledRejection", (reason) => handleFatalError(reason));

// ── Composition Root ─────────────────────────────────────────────────────
try {
  const container = createContainer();
  addInfrastructure(container);
  addApplication(container);
  addPublic(container);
  renderCLI(container.resolve(APP_SERVICES));
} catch (err) {
  handleFatalError(err);
}
```

---

## 5. FLUXO DE VALIDAÇÃO ATUAL

```
UI → Service → UseCase(recebe IValidator pelo DI) → Validator
```

Cada Use Case recebe seu validator via construtor (DI), cria a entidade com `criar()` para validar invariantes, depois delega ao validator:

```typescript
// src/application/credential/use-cases/ValidateEmailUseCase.ts
export class ValidateEmailUseCase {
  constructor(private readonly validator: IEmailValidator) {}

  async execute(email: string, password: string): Promise<Result<boolean>> {
    const credential = EmailCredential.criar(email, password);
    if (credential.isFailure) return Result.fail(credential.error!);
    return Result.ok(await this.validator.validateCredentials(email, password));
  }
}
```

### DI — Infra registra adapters, Application registra use cases

```typescript
// src/infra/DependencyInjection.ts
export function addInfrastructure(container: Container): void {
  container.register(TOKENS.ILogger, () => new ChalkLogger());
  container.register(TOKENS.IGitHubScraper, () => new GitHubScraper());
  container.register(TOKENS.IEmailValidator, () => new EmailValidatorService());
  container.register(TOKENS.IMongoValidator, () => new MongoValidatorService());
  container.register(
    TOKENS.ISupabaseValidator,
    () => new SupabaseValidatorService(),
  );
  container.register(
    TOKENS.IProxyManager,
    () => new DockerProxyManagerService(),
  );
  container.register(
    TOKENS.ICredentialEngineFactory,
    () => new CredentialEngineFactory(),
  );
  container.register(
    TOKENS.IReverseProxyModuleFactory,
    () => new ReverseProxyModuleFactory(),
  );
  container.register(
    TOKENS.ImapListenerFactory,
    () => () => new ImapListenerService(),
  );
  container.register(
    TOKENS.EmailMonitorServiceFactory,
    () => () => new EmailMonitorService(),
  );
}

// src/application/DependencyInjection.ts
export function addApplication(container: Container): void {
  container.register(
    TOKENS.LoggingBehavior,
    (c) => new LoggingBehavior(c.resolve(TOKENS.ILogger)),
  );
  container.register(
    TOKENS.ValidateEmailUseCase,
    (c) => new ValidateEmailUseCase(c.resolve(TOKENS.IEmailValidator)),
  );
  container.register(
    TOKENS.ValidateMongoUseCase,
    (c) => new ValidateMongoUseCase(c.resolve(TOKENS.IMongoValidator)),
  );
  container.register(
    TOKENS.ValidateSupabaseUseCase,
    (c) => new ValidateSupabaseUseCase(c.resolve(TOKENS.ISupabaseValidator)),
  );
  container.register(
    TOKENS.MassiveValidationUseCase,
    (c) =>
      new MassiveValidationUseCase(
        c.resolve(TOKENS.IGitHubScraper),
        c.resolve(TOKENS.ICredentialEngineFactory),
      ),
  );
}
```

---

## 6. RESULT PATTERN

Já implementado em `src/shared/Result.ts`. Usar em:

- **Entidades:** factory `criar()` retorna `Result<Entity>`.
- **Use Cases:** retornam `Result<DTO>`.
- **throw** apenas para situações irrecuperáveis (config ausente, infra morta).

```typescript
export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly value?: T,
    public readonly error?: string,
  ) {}

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, value);
  }
  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, undefined, error);
  }
  get isFailure(): boolean {
    return !this.isSuccess;
  }
}
```

---

## 6b. OBSERVABLE PATTERN

Implementado em `src/shared/Observable.ts`. Usar para push-based state na UI, eliminando polling.

```typescript
// src/shared/Observable.ts
export class Observable<T> {
  constructor(initialValue: T);
  get value(): T;
  subscribe(listener: (value: T) => void): () => void;  // retorna unsubscribe
  emit(value: T): void;
}
```

### Uso em services (Public):

```typescript
// ProxyAmbientService expõe status reativo
export class ProxyAmbientService {
  get status$(): Observable<ProxyStatus>;  // UI subscribes aqui
  async start(): Promise<void>;            // emite novo status após start
  async stop(): Promise<void>;             // emite novo status após stop
  async refreshStatus(): Promise<ProxyStatus>;  // poll manual + emit
}
```

### Uso em componentes (React/Ink):

```typescript
// public/hooks/useObservable.ts
import { useObservable } from "../hooks/useObservable.js";

const proxyStatus = useObservable(service.status$);  // re-render automático
```

### Quando usar Observable vs callback:

- **Observable:** Estado que muda ao longo do tempo e múltiplos consumers precisam observar (ProxyStatus, connection state).
- **Callback:** Eventos one-shot ou stream de dados que só um consumer processa (logs, onExit).

---

## 7. TRATAMENTO DE ERROS

Hierarquia em `src/errors/`:

- `DomainError` (abstrata) — base para regras de negócio violadas.
- `NotFoundError` (`extends DomainError`) — recurso inexistente.
- `InvalidCommandError` (`extends DomainError`) — comando malformado.
- `ConfigError` — variável de ambiente ausente.
- `InfrastructureError` — falha técnica (banco, rede, Docker).

**Quando usar throw vs Result:**

- **throw:** Situações irrecuperáveis (bug, config ausente, infra morta).
- **Result:** Situações esperadas de negócio (email duplicado, validação falhou).

Middleware global de erro em `main.ts` (já implementado).

---

## 8. ESTRUTURA DE PASTAS ATUAL

```
📂 src/
 ┣ 📂 domain/
 ┃ ┣ 📂 entities/          EmailCredential, MongoCredential, SupabaseCredential, ScrapingResult, Proxy, Email (DTO IMAP)
 ┃ ┣ 📂 value-objects/     (futuro — EmailAddress, MongoUri quando necessário)
 ┃ ┣ 📂 ports/             IEmailValidator, IMongoValidator, ISupabaseValidator, IGitHubScraper,
 ┃ ┃                        IProxyManager, IImapListener, IEmailMonitorService
 ┃ ┣ 📂 commands/          ValidateEmailCommand, ValidateMongoCommand, ValidateSupabaseCommand,
 ┃ ┃                        ImapStartListenCommand, ImapStopListenCommand,
 ┃ ┃                        StartReverseProxyCommand, StopReverseProxyCommand,
 ┃ ┃                        StartEmailMonitorCommand, StopEmailMonitorCommand
 ┃ ┣ 📂 patterns/          ICommandHandler, IMediator
 ┃ ┗ 📂 proxy/reverse/     IBlockEngine, IReplaceEngine, IHtmlSanitizer, IRulesRepository, ProxyRules
 ┣ 📂 application/
 ┃ ┣ 📂 credential/
 ┃ ┃ ┗ 📂 use-cases/       ValidateEmailUseCase, ValidateMongoUseCase, ValidateSupabaseUseCase
 ┃ ┣ 📂 email/
 ┃ ┃ ┣ 📂 dto/             EmailOutputDTO
 ┃ ┃ ┗ 📂 validators/      ValidateEmailCommandValidator
 ┃ ┣ 📂 mongo/validators/  ValidateMongoCommandValidator
 ┃ ┣ 📂 supabase/validators/ ValidateSupabaseCommandValidator
 ┃ ┣ 📂 proxy/
 ┃ ┃ ┗ 📂 reverse/         ProcessProxyRequestUseCase, ReverseProxyContext, IReverseProxyModuleFactory, IHttpClient, IReverseProxyServer
 ┃ ┣ 📂 usecase/           MassiveValidationUseCase
 ┃ ┣ 📂 common/            ICredentialEngine, ILogger, IValidator, LoggingBehavior, ValidationBehavior
 ┃ ┗ 📜 DependencyInjection.ts
 ┣ 📂 infra/
 ┃ ┣ 📂 adapters/
 ┃ ┃ ┣ 📂 credential/      EmailValidatorService, MongoValidatorService, SupabaseValidatorService
 ┃ ┃ ┣ 📂 scraping/        GitHubScrapper
 ┃ ┃ ┣ 📂 proxy/           DockerProxyManagerService
 ┃ ┃ ┃ ┗ 📂 reverse/       ExpressReverseProxyServer, FetchHttpClient, BlockEngine, ReplaceEngine, HtmlSanitizer, RulesJsonRepository
 ┃ ┃ ┗ 📂 monitoring/      ImapListenerService, EmailMonitorService
 ┃ ┣ 📂 engine/            CredentialEngine, CredentialEngineFactory
 ┃ ┣ 📂 cross-cutting/     ChalkLogger
 ┃ ┣ 📂 modules/           ReverseProxyModule, ReverseProxyModuleFactory
 ┃ ┣ 📂 proxy/             ProxyTls
 ┃ ┣ 📂 utils/             spinner
 ┃ ┗ 📜 DependencyInjection.ts
 ┣ 📂 config/              GithubConfig, AppConfig, index
 ┣ 📂 shared/              Container.ts (Token<T> + TOKENS), Result.ts, Observable.ts
 ┗ 📂 errors/              DomainError, NotFoundError, ConfigError, InfrastructureError, InvalidCommandError, index
📂 public/
 ┣ 📂 components/          App, HackerMenu, EmailWindow, MongoTestWindow, SupabaseTestWindow,
 ┃                          ProxyWindow, ProxyReverseWindow, WebScraperWindow, ExecutionPanel,
 ┃                          ExecutionWindow, Header, LogPanel, MenuPanel, StatusDisplay, WindowsPanel,
 ┃                          CursorTextInput, DragGhost, GlitchText, HackerSpinner, MatrixBackground, SexyArtPanel
 ┣ 📂 services/            ImapListenService, EmailMonitorService, ScrapValidateService,
 ┃                          MongoTestService, SupabaseTestService, GitHubScraperService,
 ┃                          ProxyAmbientService, ProxyReverseService, EmailSendService, ArtService,
 ┃                          ServicesContext.ts
 ┣ 📂 hooks/               useMouse, useObservable, windowStore
 ┣ 📂 types/               index
 ┣ 📜 DependencyInjection.ts (APP_SERVICES token + addPublic)
 ┣ 📜 cli.tsx              (renderCLI — recebe AppServices)
 ┗ 📜 theme.ts
📂 tests/
 ┣ 📂 unit/
 ┃ ┣ 📂 domain/            EmailCredential.test, MongoCredential.test, SupabaseCredential.test,
 ┃ ┃                        ScrapingResult.test, Proxy.test, Email.test
 ┃ ┣ 📂 application/       ValidateEmailUseCase.test, ValidateMongoUseCase.test, ValidateSupabaseUseCase.test,
 ┃ ┃                        MassiveValidationUseCase.test, LoggingBehavior.test, ValidationBehavior.test
 ┃ ┗ 📂 shared/            Result.test, Observable.test
 ┣ 📂 integration/         di-container.test
 ┣ 📂 mocks/               MockEmailValidator, MockMongoValidator, MockSupabaseValidator,
 ┃                          MockGitHubScraper, MockCredentialEngineFactory, MockLogger,
 ┃                          MockProxyManager, MockReverseProxyModuleFactory,
 ┃                          MockImapListener, MockEmailMonitorService, index
 ┗ 📜 setup.ts
📜 main.ts                 (Composition Root + middleware global de erro)
```

---

## 9. REGRAS DE CÓDIGO (INEGOCIÁVEIS)

### SOLID

- **S:** Uma classe, uma razão para mudar.
- **O:** Novo tipo de credencial = nova classe validator, novo use case. Código existente não abre.
- **L:** `SmtpValidator` substituível por `MockEmailValidator` nos testes sem quebrar.
- **I:** Interfaces enxutas. Cada validator tem sua interface com parâmetros específicos.
- **D:** Application, Domain e Public NUNCA dependem de Infra. Dependem de interfaces.

### Clean Code

- Funções = verbos, classes = substantivos.
- Máximo 20 linhas por função.
- Nível de abstração único por função.

### DRY

- Se duas classes têm a mesma estrutura, extraia.
- Nunca retorne `null` → use `Result<T>`.
- Proibido `try-catch` espalhado → middleware global de erro.

### Injeção de Dependência

- Toda dependência via construtor. PROIBIDO `new ClasseConcreta()` fora do Composition Root.
- **UM container central** (`src/shared/Container.ts`) com `Token<T>`. Proibido criar mini-containers.
- Cada camada expõe `DependencyInjection.ts`.

---

## 10. CONFIG

Centralizado em `src/config/`. `dotenv.config()` chamado **uma única vez** em `main.ts`.

- `GithubConfig` — `COOKIE_GIT*`.
- `AppConfig` — `DATABASE_URL` e outras.
- PROIBIDO `process.env.X` fora de `src/config/`.
- Toda classe Config lança `ConfigError` se valor ausente.

---

## 11. TESTES

### Estrutura atual — 155 testes passando

```
tests/
 ┣ unit/
 ┃ ┣ domain/            (entidades — criar() válido/inválido, invariantes)
 ┃ ┣ application/       (use cases — com mocks dos validators)
 ┃ ┗ shared/            (Result, Observable — ok/fail/subscribe/emit)
 ┣ integration/         (DI container — resolução completa com mocks)
 ┣ mocks/               (MockEmailValidator, MockMongoValidator, MockSupabaseValidator,
 ┃                        MockGitHubScraper, MockCredentialEngineFactory, MockLogger,
 ┃                        MockProxyManager, MockReverseProxyModuleFactory,
 ┃                        MockImapListener, MockEmailMonitorService)
 ┗ setup.ts
```

### Regras

- **Arrange-Act-Assert.** Três seções claras.
- **Mocks só para fronteiras** — interfaces do Domain (validators, scraper, engine factory).
- **Testes de entidade:** testar `criar()` com dados válidos e inválidos, testar invariantes (ex: Proxy state machine).
- **Testes de use case:** testar com mocks dos validators.
- **Cobertura mínima:** 80% em Domain e Application.

### Mock pattern:

```typescript
export class MockEmailValidator implements IEmailValidator {
  public calls: Array<{ email: string; password: string }> = [];
  public result = true;

  async validateCredentials(email: string, password: string): Promise<boolean> {
    this.calls.push({ email, password });
    return this.result;
  }
}
```

---

## 12. SEGURANÇA

- NUNCA commite cookies/senhas. Tudo em `.env`.
- NUNCA logue credenciais completas. Logue indicadores (`email: user@***.com`).
- `.gitignore` cobre `.env`, `*.cookies`, `output/`, `temp/`.

---

## 13. PERFORMANCE E CONCORRÊNCIA

- **Batch processing:** Divida arrays grandes em chunks configuráveis.
- **Concurrency limit:** `Promise.allSettled` com limite (ex: 5 simultâneos), nunca `Promise.all` ilimitado.
- **Progress reporting:** Callback `onProgress(current, total)` em Use Cases longos.
- **Cancellation:** `AbortController` para cancelamento.
- **Retry com backoff:** Para operações de rede, exponential backoff na Infra.

---

## 14. PERSISTÊNCIA — VISÃO FUTURA (NÃO IMPLEMENTAR AGORA)

A persistência atual é em arquivos `.txt` espalhados. **Não mexer nisso agora.** Quando chegar a hora:

```typescript
// src/domain/ports/IDataAccess.ts (FUTURO — não criar agora)
export interface IDataAccess {
  findMany<T>(collection: string, query?: Partial<T>): Promise<T[]>;
  findOne<T>(collection: string, query: Partial<T>): Promise<T | undefined>;
  create<T>(
    collection: string,
    data: Partial<T>,
  ): Promise<string | number | undefined>;
  update<T>(
    collection: string,
    query: Partial<T>,
    data: Partial<T>,
  ): Promise<number>;
  remove(collection: string, query: Partial<any>): Promise<number>;
}

// src/domain/ports/IRepository.ts (FUTURO — não criar agora)
export interface IRepository<T> {
  save(entity: T): Promise<Result<void>>;
}
```

Quando implementarmos, a Infra terá `TextFileRepository` (o que já faz hoje) e depois `MongoRepository`, `SqliteRepository`, etc. O resto do sistema não muda.

---

## 15. HISTÓRICO DE REFATORAÇÃO

### Fase 1 — Config + Errors + Centralizar process.env ✅

### Fase 2 — Corrigir violações de camada (Public → Infra) ✅

### Fase 3 — DependencyInjection.ts + Composition Root ✅

### Fase 4 — Compilação + Erros Tipados ✅

### Fase 5 — Criar entidades reais no Domain ✅

### Fase 6 — Colapsar validação (eliminar módulos wrapper) ✅

### Fase 7 — Simplificar Proxy ✅

### Fase 8 — Reorganizar pastas ✅

### Melhoria — Container type-safe com Token<T> ✅

### Observable para estado do Proxy ✅

### Testes de integração com DI container ✅

### CI script (`npm run ci`) ✅

### Limpeza de código morto na Application ✅

---

## 16. PRÓXIMAS IMPLEMENTAÇÕES

### Prioridade Alta

1. **Value Objects** — `EmailAddress`, `MongoUri`, `SupabaseUrl` quando a validação crescer.
2. **Decorator pattern** — se os Behaviours (Logging, Validation) precisarem ser compostos por Use Case.
3. **Consolidar pastas da Application** — `email/`, `mongo/`, `supabase/` podem ser simplificados (validators soltos).

### Prioridade Média

4. **Persistência** — implementar `IDataAccess` + `IRepository<T>` com `TextFileRepository`.
5. **Migrar container** — considerar `tsyringe` com decorators quando o projeto crescer.
6. **JSDoc** nos contratos públicos de cada camada.

---

## 17. TEMPLATES PARA CÓDIGO NOVO

### Novo Use Case:

```typescript
// src/application/[modulo]/use-cases/[NomeUseCase].ts
import type { I[Porta] } from "../../../domain/ports/I[Porta].js";
import { Result } from "../../../shared/Result.js";

export class [NomeUseCase] {
  constructor(private readonly dep: I[Porta]) {}

  async execute(input: [Params]): Promise<Result<[Output]>> {
    // 1. Validar/criar entidade
    // 2. Delegar para porta
    // 3. Retornar Result.ok ou Result.fail
  }
}
```

### Nova Entidade:

```typescript
// src/domain/entities/[Nome].ts
import { Result } from "../../shared/Result.js";
import { randomUUID } from "crypto";

export class [Nome] {
  private constructor(
    public readonly id: string,
    /* campos */
    public readonly createdAt: Date,
  ) {}

  static criar(/* params */): Result<[Nome]> {
    // Validar invariantes
    // return Result.fail("motivo") ou Result.ok(new [Nome](...))
  }
}
```

### Novo Token no Container:

```typescript
// 1. Em src/shared/Container.ts — adicionar ao TOKENS:
import type { INovoDep } from "../domain/ports/INovoDep.js";
// ...
export const TOKENS = {
  // ...existentes
  INovoDep: new Token<INovoDep>("INovoDep"),
};

// 2. Em src/infra/DependencyInjection.ts:
container.register(TOKENS.INovoDep, () => new NovoDepImpl());

// 3. Se Application precisa, no src/application/DependencyInjection.ts:
container.register(
  TOKENS.NovoUseCase,
  (c) => new NovoUseCase(c.resolve(TOKENS.INovoDep)),
);
```

---

## 18. CHECKLIST PARA CÓDIGO NOVO

1. **Em qual camada mora?** Domain, Application, Infra, Public, Config, Shared, Errors.
2. **De quem depende?** Se depende de Infra e não é Infra → errado.
3. **Quem depende dele?** Se Domain depende dele e ele tem lib externa → errado.
4. **Tem teste?** Se é Use Case ou Entidade → teste obrigatório.
5. **Recebe deps pelo construtor?** Se faz `new` de outra camada → errado.
6. **Token registrado?** Se é injetável → precisa de `Token<T>` e registro no `DependencyInjection.ts`.
7. **Usa `Result<T>`?** Se retorna dado que pode falhar por regra de negócio → deve usar Result.
8. **Log é seguro?** Se loga dados → credenciais mascaradas.
9. **Compila?** `npx tsc --noEmit` passa.
10. **Testes passam?** `npx vitest run` passa.

---

## 19. REGRA DE OURO

> Se deletar toda a Infra e Application, o Domain ainda faz sentido sozinho.
>
> Se trocar a UI (CLI → Web → API → Bot), Application e Domain não mudam.
>
> Se `public/` importa de `src/infra/`, a arquitetura está quebrada.
>
> Se `src/application/` importa de `src/infra/`, a arquitetura está quebrada.
>
> Se existem 3 classes fazendo a mesma coisa com nomes diferentes, o DRY está quebrado.
>
> Se um módulo cria seu próprio container DI interno, o Composition Root está quebrado.
>
> Se um `resolve()` retorna `any` em vez do tipo inferido, o Token<T> não está sendo usado.
>
> O `main.ts` é o maestro. As camadas afinam seus instrumentos via `DependencyInjection.ts`.
> Sempre rodar o codigo após qualquer mudança, rode como usuario, rode os testes, e confie no processo. Se algo quebrou, o processo de revisão e testes vai pegar. Se algo passou sem ser notado, o processo falhou e precisa ser reforçado, não ignorado.