#!/usr/bin/env node
import { config } from "dotenv";
config();

import { createContainer } from "./src/shared/Container.js";
import { addInfrastructure } from "./src/infra/DependencyInjection.js";
import { addApplication }    from "./src/application/DependencyInjection.js";
import { addPublic, APP_SERVICES } from "./public/DependencyInjection.js";
import { renderCLI }         from "./public/cli.js";
import { DomainError, ConfigError, InfrastructureError } from "./src/errors/index.js";


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

process.on("uncaughtException",  (err) => handleFatalError(err));
process.on("unhandledRejection", (reason) => handleFatalError(reason));

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.error("\n[*] Shutting down...");
    process.exit(0);
  });
}

try {
  const container = createContainer();
  addInfrastructure(container);
  addApplication(container);
  addPublic(container);

  renderCLI(container.resolve(APP_SERVICES));
} catch (err) {
  handleFatalError(err);
}

