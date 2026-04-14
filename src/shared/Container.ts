import { ConfigError } from "../errors/index.js";
import type { ILogger } from "../application/common/ILogger.js";
import type { IMediator } from "../domain/patterns/IMediator.js";
import type { IGitHubScraper } from "../domain/ports/IGitHubScraper.js";
import type { IEmailValidator } from "../domain/ports/IEmailValidator.js";
import type { IMongoValidator } from "../domain/ports/IMongoValidator.js";
import type { ISupabaseValidator } from "../domain/ports/ISupabaseValidator.js";
import type { IProxyManager } from "../domain/ports/IProxyManager.js";
import type { IImapListener } from "../domain/ports/IImapListener.js";
import type { IImapClient } from "../domain/ports/IImapClient.js";
import type { IEmailSender } from "../domain/ports/IEmailSender.js";
import type { IEmailMonitorService } from "../domain/ports/IEmailMonitorService.js";
import type { IFileStorage } from "../application/common/IFileStorage.js";
import type { IClipboard } from "../application/common/IClipboard.js";
import type { IKeywordReader } from "../application/common/IKeywordReader.js";
import type { ICredentialEngineFactory } from "../application/common/ICredentialEngine.js";
import type { IReverseProxyModuleFactory } from "../application/proxy/reverse/IReverseProxyModuleFactory.js";
import type { LoggingBehavior } from "../application/common/LoggingBehavior.js";
import type { ValidateEmailHandler } from "../application/email/handlers/ValidateEmailHandler.js";
import type { ValidateMongoHandler } from "../application/mongo/handlers/ValidateMongoHandler.js";
import type { ValidateSupabaseHandler } from "../application/supabase/handlers/ValidateSupabaseHandler.js";
import type { MassiveValidationUseCase } from "../application/scraping/use-cases/MassiveValidationUseCase.js";


import type { SendEmailHandler } from "../application/email/handlers/SendEmailHandler.js";
import type { FetchInboxHandler } from "../application/email/handlers/FetchInboxHandler.js";
import type { VerifyImapCredentialHandler } from "../application/email/handlers/VerifyImapCredentialHandler.js";
import type { ReadCredentialsHandler } from "../application/email/handlers/ReadCredentialsHandler.js";
import type { AppendCredentialHandler } from "../application/email/handlers/AppendCredentialHandler.js";
import type { ImapStartListenHandler } from "../application/email/handlers/ImapStartListenHandler.js";
import type { ImapStopListenHandler } from "../application/email/handlers/ImapStopListenHandler.js";
import type { StartEmailMonitorHandler } from "../application/email/handlers/StartEmailMonitorHandler.js";
import type { StopEmailMonitorHandler } from "../application/email/handlers/StopEmailMonitorHandler.js";


import type { StartAmbientProxyHandler } from "../application/proxy/handlers/StartAmbientProxyHandler.js";
import type { StopAmbientProxyHandler } from "../application/proxy/handlers/StopAmbientProxyHandler.js";
import type { RefreshProxyStatusHandler } from "../application/proxy/handlers/RefreshProxyStatusHandler.js";
import type { StartReverseProxyHandler } from "../application/proxy/handlers/StartReverseProxyHandler.js";
import type { StopReverseProxyHandler } from "../application/proxy/handlers/StopReverseProxyHandler.js";


import type { ExecuteGitHubScrapingHandler } from "../application/scraping/handlers/ExecuteGitHubScrapingHandler.js";
import type { ValidateGitHubBotHandler } from "../application/scraping/handlers/ValidateGitHubBotHandler.js";
import type { ReadKeywordsHandler } from "../application/scraping/handlers/ReadKeywordsHandler.js";
import type { ExecuteScrapValidatePipelineHandler } from "../application/scraping/handlers/ExecuteScrapValidatePipelineHandler.js";


import type { ExecuteMongoValidationHandler } from "../application/mongo/handlers/ExecuteMongoValidationHandler.js";
import type { ExecuteMongoMassiveHandler } from "../application/mongo/handlers/ExecuteMongoMassiveHandler.js";


import type { ExecuteSupabaseValidationHandler } from "../application/supabase/handlers/ExecuteSupabaseValidationHandler.js";
import type { ExecuteSupabaseMassiveHandler } from "../application/supabase/handlers/ExecuteSupabaseMassiveHandler.js";


import type { IEmailController } from "../application/email/IEmailController.js";
import type { IMongoController } from "../application/mongo/IMongoController.js";
import type { ISupabaseController } from "../application/supabase/ISupabaseController.js";
import type { IProxyController } from "../application/proxy/IProxyController.js";
import type { IProxyReverseController } from "../application/proxy/IProxyReverseController.js";
import type { IScraperController } from "../application/scraping/IScraperController.js";
import type { IRansomController } from "../application/ransom/IRansomController.js";
import type { IRansomCompiler } from "../domain/ports/IRansomCompiler.js";
import type { CompileRansomUseCase } from "../application/ransom/use-cases/CompileRansomUseCase.js";
import type { IPythonWsClient } from "../domain/ports/IPythonWsClient.js";
import type { IC2Controller } from "../application/c2/IC2Controller.js";
import type { IC2Compiler } from "../domain/ports/IC2Compiler.js";
import type { IC2RelayClient } from "../domain/ports/IC2RelayClient.js";
import type { IC2ServerManager } from "../domain/ports/IC2ServerManager.js";
import type { CompileC2UseCase } from "../application/c2/use-cases/CompileC2UseCase.js";

type Factory<T> = (c: Container) => T;


export class Token<T> {
  declare readonly _type: T;
  constructor(public readonly key: string) {}
}


export const TOKENS = {

  ILogger:                    new Token<ILogger>("ILogger"),
  IGitHubScraper:             new Token<IGitHubScraper>("IGitHubScraper"),
  IEmailValidator:            new Token<IEmailValidator>("IEmailValidator"),
  IMongoValidator:            new Token<IMongoValidator>("IMongoValidator"),
  ISupabaseValidator:         new Token<ISupabaseValidator>("ISupabaseValidator"),
  IProxyManager:              new Token<IProxyManager>("IProxyManager"),
  ICredentialEngineFactory:   new Token<ICredentialEngineFactory>("ICredentialEngineFactory"),
  IReverseProxyModuleFactory: new Token<IReverseProxyModuleFactory>("IReverseProxyModuleFactory"),


  IImapClient:                new Token<IImapClient>("IImapClient"),
  IEmailSender:               new Token<IEmailSender>("IEmailSender"),
  IFileStorage:               new Token<IFileStorage>("IFileStorage"),
  IClipboard:                 new Token<IClipboard>("IClipboard"),
  IKeywordReader:             new Token<IKeywordReader>("IKeywordReader"),


  ImapListenerFactory:        new Token<() => IImapListener>("ImapListenerFactory"),
  EmailMonitorServiceFactory: new Token<() => IEmailMonitorService>("EmailMonitorServiceFactory"),


  IMediator:                  new Token<IMediator>("IMediator"),
  LoggingBehavior:            new Token<LoggingBehavior>("LoggingBehavior"),
  MassiveValidationUseCase:   new Token<MassiveValidationUseCase>("MassiveValidationUseCase"),


  ValidateEmailHandler:           new Token<ValidateEmailHandler>("ValidateEmailHandler"),
  SendEmailHandler:               new Token<SendEmailHandler>("SendEmailHandler"),
  FetchInboxHandler:              new Token<FetchInboxHandler>("FetchInboxHandler"),
  VerifyImapCredentialHandler:    new Token<VerifyImapCredentialHandler>("VerifyImapCredentialHandler"),
  ReadCredentialsHandler:         new Token<ReadCredentialsHandler>("ReadCredentialsHandler"),
  AppendCredentialHandler:        new Token<AppendCredentialHandler>("AppendCredentialHandler"),
  ImapStartListenHandler:         new Token<ImapStartListenHandler>("ImapStartListenHandler"),
  ImapStopListenHandler:          new Token<ImapStopListenHandler>("ImapStopListenHandler"),
  StartEmailMonitorHandler:       new Token<StartEmailMonitorHandler>("StartEmailMonitorHandler"),
  StopEmailMonitorHandler:        new Token<StopEmailMonitorHandler>("StopEmailMonitorHandler"),


  ValidateMongoHandler:           new Token<ValidateMongoHandler>("ValidateMongoHandler"),
  ExecuteMongoValidationHandler:  new Token<ExecuteMongoValidationHandler>("ExecuteMongoValidationHandler"),
  ExecuteMongoMassiveHandler:     new Token<ExecuteMongoMassiveHandler>("ExecuteMongoMassiveHandler"),


  ValidateSupabaseHandler:           new Token<ValidateSupabaseHandler>("ValidateSupabaseHandler"),
  ExecuteSupabaseValidationHandler:  new Token<ExecuteSupabaseValidationHandler>("ExecuteSupabaseValidationHandler"),
  ExecuteSupabaseMassiveHandler:     new Token<ExecuteSupabaseMassiveHandler>("ExecuteSupabaseMassiveHandler"),


  StartAmbientProxyHandler:     new Token<StartAmbientProxyHandler>("StartAmbientProxyHandler"),
  StopAmbientProxyHandler:      new Token<StopAmbientProxyHandler>("StopAmbientProxyHandler"),
  RefreshProxyStatusHandler:    new Token<RefreshProxyStatusHandler>("RefreshProxyStatusHandler"),
  StartReverseProxyHandler:     new Token<StartReverseProxyHandler>("StartReverseProxyHandler"),
  StopReverseProxyHandler:      new Token<StopReverseProxyHandler>("StopReverseProxyHandler"),


  ExecuteGitHubScrapingHandler:        new Token<ExecuteGitHubScrapingHandler>("ExecuteGitHubScrapingHandler"),
  ValidateGitHubBotHandler:            new Token<ValidateGitHubBotHandler>("ValidateGitHubBotHandler"),
  ReadKeywordsHandler:                 new Token<ReadKeywordsHandler>("ReadKeywordsHandler"),
  ExecuteScrapValidatePipelineHandler: new Token<ExecuteScrapValidatePipelineHandler>("ExecuteScrapValidatePipelineHandler"),


  IRansomCompiler:          new Token<IRansomCompiler>("IRansomCompiler"),
  CompileRansomUseCase:     new Token<CompileRansomUseCase>("CompileRansomUseCase"),
  IPythonWsClient:          new Token<IPythonWsClient>("IPythonWsClient"),


  IC2Compiler:              new Token<IC2Compiler>("IC2Compiler"),
  IC2RelayClient:           new Token<IC2RelayClient>("IC2RelayClient"),
  IC2ServerManager:         new Token<IC2ServerManager>("IC2ServerManager"),
  CompileC2UseCase:         new Token<CompileC2UseCase>("CompileC2UseCase"),


  EmailController:          new Token<IEmailController>("EmailController"),
  MongoController:          new Token<IMongoController>("MongoController"),
  SupabaseController:       new Token<ISupabaseController>("SupabaseController"),
  ProxyController:          new Token<IProxyController>("ProxyController"),
  ProxyReverseController:   new Token<IProxyReverseController>("ProxyReverseController"),
  ScraperController:        new Token<IScraperController>("ScraperController"),
  RansomController:         new Token<IRansomController>("RansomController"),
  C2Controller:             new Token<IC2Controller>("C2Controller"),
} as const;


export class Container {
  private readonly _factories  = new Map<string, Factory<unknown>>();
  private readonly _singletons = new Map<string, unknown>();

  register<T>(token: Token<T>, factory: Factory<T>): this {
    this._factories.set(token.key, factory as Factory<unknown>);
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const key = token.key;
    if (!this._singletons.has(key)) {
      const factory = this._factories.get(key);
      if (!factory) throw new ConfigError(`Dependência '${key}' não registrada no container`);
      this._singletons.set(key, factory(this));
    }
    return this._singletons.get(key) as T;
  }
}

export function createContainer(): Container {
  return new Container();
}

