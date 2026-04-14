import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import type { AppServices } from "./services/ServicesContext.js";

const disableMouse = () => process.stdout.write("\x1b[?1006l\x1b[?1002l\x1b[?1000l");
process.on("exit", disableMouse);
process.on("SIGINT",  () => { disableMouse(); process.exit(0); });
process.on("SIGTERM", () => { disableMouse(); process.exit(0); });

export function renderCLI(services: AppServices): void {
  const { waitUntilExit } = render(<App services={services} />);
  waitUntilExit()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

