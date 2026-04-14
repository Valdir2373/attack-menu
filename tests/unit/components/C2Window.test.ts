import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render as inkRender } from "ink";
import { PassThrough } from "stream";

import { ServicesContext } from "../../../public/services/ServicesContext.js";
import { C2Window } from "../../../public/components/C2Window.js";
import type { AppServices } from "../../../public/services/ServicesContext.js";
import type { IC2Controller } from "../../../src/application/c2/IC2Controller.js";
import { MockC2RelayClient } from "../../mocks/MockC2RelayClient.js";
import { snapClear } from "../../../public/hooks/windowStore.js";
import { Result } from "../../../src/shared/Result.js";

// ── Sequências ANSI ──────────────────────────────────────────────────────────
const DOWN  = "\x1B[B";
const ENTER = "\r";
const ESC   = "\x1B";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Cria stdout/stdin falsos que satisfazem o que o Ink v5 precisa. */
function createInkEnv() {
  const stdout = new PassThrough();
  (stdout as any).columns = 120;
  (stdout as any).rows    = 40;

  const stdin = new PassThrough();
  (stdin as any).isTTY      = true;
  (stdin as any).setEncoding = () => stdin;
  (stdin as any).setRawMode  = () => {};
  (stdin as any).resume      = () => stdin;
  (stdin as any).ref         = () => {};
  (stdin as any).unref       = () => {};

  return {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin:  stdin  as unknown as NodeJS.ReadStream,
    write:  (seq: string) => (stdin as unknown as PassThrough).write(seq),
  };
}

/** Dois setImmediate garantem que o React processa os state updates pendentes. */
async function flush() {
  await new Promise<void>((r) => setImmediate(r));
  await new Promise<void>((r) => setImmediate(r));
}

let _id = 0;

/** Renderiza C2Window num TTY falso. Retorna helpers de interação e limpeza. */
function renderC2(props: { onClose?: () => void; onBlur?: () => void }) {
  const id    = `c2-test-${++_id}`;
  const relay = new MockC2RelayClient(); // isConnected() = false por padrão

  const c2Controller: IC2Controller = {
    relay,
    async compile()     { return Result.fail("mock"); },
    async startServer() { return Result.fail("mock"); },
    async stopServer()  {},
  };

  const services = { c2Controller } as unknown as AppServices;
  const env = createInkEnv();

  const element = React.createElement(
    ServicesContext.Provider,
    { value: services },
    React.createElement(C2Window, {
      id,
      height:    20,
      isFocused: true,
      onClose:   props.onClose,
      onBlur:    props.onBlur,
    }),
  );

  const { unmount } = inkRender(element, {
    stdout:       env.stdout,
    stdin:        env.stdin,
    exitOnCtrlC:  false,
    patchConsole: false,
  });

  return {
    async press(seq: string) {
      env.write(seq);
      await flush();
    },
    cleanup() {
      unmount();
      snapClear(id);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Testes ───────────────────────────────────────────────────────────────────

describe("C2Window — callback onClose", () => {
  /**
   * REGRESSÃO: onClose foi declarado em Props mas nunca desestruturado.
   * A referência `onClose?.()` lançava ReferenceError → capturado pelo handler
   * global de main.ts → process.exit(1) → app inteiro encerrava.
   *
   * Este teste falha se onClose não for desestruturado corretamente.
   */
  it("chama onClose ao selecionar Fechar no menu idle (sem conexão)", async () => {
    const onClose = vi.fn();
    const { press, cleanup } = renderC2({ onClose });
    try {
      // idle desconectado: ["Iniciar servidor local", "Conectar remoto", "Fechar"]
      await press(DOWN);   // cursor 0 → 1
      await press(DOWN);   // cursor 1 → 2  ("Fechar")
      await press(ENTER);  // confirma seleção
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      cleanup();
    }
  });

  it("nao chama onClose ao pressionar ESC no idle (apenas blur)", async () => {
    const onClose = vi.fn();
    const onBlur  = vi.fn();
    const { press, cleanup } = renderC2({ onClose, onBlur });
    try {
      await press(ESC);
      expect(onClose).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledOnce();
    } finally {
      cleanup();
    }
  });

  it("nao chama onClose ao voltar de connect_list com ESC (navegacao interna)", async () => {
    const onClose = vi.fn();
    const { press, cleanup } = renderC2({ onClose });
    try {
      // abre connect_list
      await press(DOWN);   // cursor → 1 ("Conectar em servidor remoto")
      await press(ENTER);
      // volta com ESC — deve retornar ao idle, sem fechar a janela
      await press(ESC);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});

describe("C2Window — callback onBlur", () => {
  it("chama onBlur ao pressionar ESC no menu idle", async () => {
    const onBlur = vi.fn();
    const { press, cleanup } = renderC2({ onBlur });
    try {
      await press(ESC);
      expect(onBlur).toHaveBeenCalledOnce();
    } finally {
      cleanup();
    }
  });

  it("nao chama onBlur ao navegar entre itens do idle", async () => {
    const onBlur = vi.fn();
    const { press, cleanup } = renderC2({ onBlur });
    try {
      await press(DOWN);
      await press(DOWN);
      expect(onBlur).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});
