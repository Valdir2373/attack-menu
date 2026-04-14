#!/usr/bin/env node
/**
 * Script de teste para validar interatividade da CLI
 * Demonstra navegação e seleção
 */

import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const _runInteractiveTest = async (): Promise<void> => {
  const cli = spawn("npx", ["tsx", "src/cli.tsx"], {
    stdio: ["pipe", "inherit", "inherit"],
    cwd: process.cwd(),
  });

  await sleep(1000);
  cli.stdin.write("\x1b[B");
  await sleep(500);
  cli.stdin.write("\x1b[B");
  await sleep(500);
  cli.stdin.write("\x1b[A");
  await sleep(500);
  cli.stdin.write("\r");

  await sleep(2000);

  cli.stdin.write("q");
  await sleep(1000);

  for (let i = 0; i < 6; i++) {
    cli.stdin.write("\x1b[B");
    await sleep(200);
  }

  cli.stdin.write("\r");
  await sleep(500);

  cli.stdin.end();
};

_runInteractiveTest().catch(console.error);
