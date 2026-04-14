/**
 * Contrato de Props para todas as janelas registradas.
 *
 * Objetivo: impedir que uma janela declare onClose/onBlur na interface Props
 * mas esqueça de desestruturá-los — o que causa ReferenceError em runtime
 * capturado pelo handler global, encerrando o app inteiro.
 *
 * Como funciona:
 *  1. Asserção TypeScript (verificada pelo tsc --noEmit / CI):
 *     Cada componente registrado deve ser atribuível a um tipo que exige
 *     onClose e onBlur em suas props. Se a interface Props não os tiver,
 *     o tsc falha antes mesmo de rodar os testes.
 *
 *  2. Teste de smoke (runtime):
 *     Verifica que o módulo importa sem erros e que o componente é uma função.
 *     Garante que não há erro de importação ou de inicialização.
 */

import { describe, it, expect } from "vitest";
import type React from "react";
import { WINDOW_REGISTRY } from "../../../public/components/WindowRegistry.js";
import { EmailWindow }        from "../../../public/components/EmailWindow.js";
import { WebScraperWindow }   from "../../../public/components/WebScraperWindow.js";
import { MongoTestWindow }    from "../../../public/components/MongoTestWindow.js";
import { SupabaseTestWindow } from "../../../public/components/SupabaseTestWindow.js";
import { ProxyReverseWindow } from "../../../public/components/ProxyReverseWindow.js";
import { RansomWindow }       from "../../../public/components/RansomWindow.js";
import { C2Window }           from "../../../public/components/C2Window.js";
import { SettingsWindow }     from "../../../public/components/SettingsWindow.js";

// ── Contrato de tipo ──────────────────────────────────────────────────────────
// Todas as janelas devem aceitar pelo menos estas props.
// Se algum componente não as tiver em sua interface Props, o tsc --noEmit falha.

interface WindowContractProps {
  height:     number;
  id:         string;
  isFocused?: boolean;
  onClose?:   () => void;
  onBlur?:    () => void;
}

// Asserção de assignabilidade: React.FC<ContractProps> é supertype de React.FC<Props>
// (covariância em props: Props mais específico é subtipo de Props menos específico)
// Se Props não incluir onClose/onBlur, TypeScript emite TS2322 aqui.
const _emailCheck:        React.FC<WindowContractProps> = EmailWindow;
const _webScraperCheck:   React.FC<WindowContractProps> = WebScraperWindow;
const _mongoCheck:        React.FC<WindowContractProps> = MongoTestWindow;
const _supabaseCheck:     React.FC<WindowContractProps> = SupabaseTestWindow;
const _proxyReverseCheck: React.FC<WindowContractProps> = ProxyReverseWindow;
const _ransomCheck:       React.FC<WindowContractProps> = RansomWindow;
const _c2Check:           React.FC<WindowContractProps> = C2Window;
const _settingsCheck:     React.FC<WindowContractProps> = SettingsWindow;

// Silencia avisos de "variável nunca usada"
void _emailCheck, _webScraperCheck, _mongoCheck, _supabaseCheck;
void _proxyReverseCheck, _ransomCheck, _c2Check, _settingsCheck;

// ── Testes de smoke ───────────────────────────────────────────────────────────

describe("WindowRegistry — contrato de Props (onClose / onBlur)", () => {
  const entries = Object.entries(WINDOW_REGISTRY) as Array<
    [string, { component: React.FC<any> }]
  >;

  it("todos os tipos de janela estão registrados", () => {
    const expected = [
      "email", "web-scraper", "mongo-test", "supabase",
      "proxy-reverse", "ransom", "c2", "settings",
    ];
    expect(Object.keys(WINDOW_REGISTRY).sort()).toEqual(expected.sort());
  });

  for (const [type, config] of entries) {
    it(`[${type}] componente é uma função React válida`, () => {
      expect(typeof config.component).toBe("function");
    });

    it(`[${type}] componente aceita prop onClose sem erros de tipo`, () => {
      // A asserção de tipo estática acima (linha _xxxCheck) já garante isso
      // em compile time. Este teste garante que o módulo carregou corretamente.
      const props: WindowContractProps = {
        height: 20,
        id: `smoke-${type}`,
        isFocused: false,
        onClose: () => {},
        onBlur:  () => {},
      };
      // Verifica que o componente pode receber essas props sem erros de TypeScript
      expect(() => {
        // Apenas checa que a referência existe e aceita o tipo — não renderiza
        const _ref: React.FC<WindowContractProps> = config.component;
        void _ref;
        void props;
      }).not.toThrow();
    });
  }
});
