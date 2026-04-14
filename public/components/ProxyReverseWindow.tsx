import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { useServices } from "../services/ServicesContext.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import { useWindowState } from "../hooks/windowStore.js";
import { PRIMARY, SECONDARY, DANGER, FOCUS, UNFOCUS, MUTED, DIM } from "../theme.js";


interface ProxyReverseWindowProps {
  id: string;
  height: number;
  isFocused?: boolean;
  onClose?: () => void;
  onBlur?: () => void;
}

const EMPTY: CursorInputField = { value: "", pos: 0 };
const DEFAULT_PORT = 1212;


export const ProxyReverseWindow: React.FC<ProxyReverseWindowProps> = ({
  id,
  height,
  isFocused = false,
  onClose,
  onBlur,
}) => {
  const { proxyReverseController: svc } = useServices();

  type Mode = "idle" | "running";

  const [mode,    setMode]    = useWindowState<Mode>(id, "mode", "idle");
  const [urlField, setUrlField] = useWindowState<CursorInputField>(id, "urlField", EMPTY);
  const [logs,    setLogs]    = useWindowState<string[]>(id, "logs", []);
  const [status,  setStatus]  = useWindowState(id, "status", svc.status);

  const appendLog = (line: string) =>
    setLogs((prev) => [...prev.slice(-200), line]);

  const startProxy = () => {
    const url = urlField.value.trim();
    if (!url) return;

    try { new URL(url); } catch {
      appendLog("[ERROR] URL inválida — use https://exemplo.com");
      return;
    }

    svc.start(
      url,
      DEFAULT_PORT,
      (line) => {
        appendLog(line);
        setStatus(svc.status);
      },
      (_code) => {
        appendLog("[>] Proxy encerrado.");
        setStatus(svc.status);
        setMode("idle");
      },
    );
    setStatus(svc.status);
    setMode("running");
    setLogs([`[>] Iniciando proxy → ${url}`]);
  };

  const stopProxy = () => {
    svc.stop();
    appendLog("[>] Encerrando proxy...");
  };

  useInput((input, key) => {
    if (key.escape) {
      if (mode === "running") { onBlur?.(); return; }
      onBlur?.();
      return;
    }

    if (mode === "idle") {
      if (key.return) { startProxy(); return; }
      if (input === "q" || input === "Q") { onClose?.(); return; }
      return;
    }

    if (mode === "running") {
      if (input === "s" || input === "S") { stopProxy(); return; }
      if (input === "q" || input === "Q") { stopProxy(); onClose?.(); return; }
      return;
    }
  }, { isActive: isFocused });


  const logLines = logs.slice(-Math.max(4, height - 12));

  const logColor = (line: string) => {
    if (line.includes("[ERROR]") || line.includes("[BLOQUEADO]")) return DANGER;
    if (line.includes("[OK]") || line.includes("[BIN]")) return MUTED;
    if (line.includes("[>]") || line.includes("Iniciando")) return SECONDARY;
    if (line.includes("PROXY") || line.includes("Local") || line.includes("Alvo")) return PRIMARY;
    return MUTED;
  };


  return (
    <Box
      borderStyle={isFocused ? "double" : "round"}
      borderColor={isFocused ? FOCUS : UNFOCUS}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      height={height}
      paddingX={1}
      overflow="hidden"
    >
      {}
      <Box flexDirection="row" gap={1}>
        <Text color={isFocused ? FOCUS : UNFOCUS} bold>
          {mode === "running" ? <><Spinner /> Proxy</> : "◈ Proxy Reverse"}
        </Text>
        {isFocused && <Text color={FOCUS} bold>{"[FOCUSED]"}</Text>}
        {mode === "running" && status.localUrl && (
          <Text color={PRIMARY} bold>{status.localUrl}</Text>
        )}
      </Box>

      <Text color={DIM}>{"─".repeat(36)}</Text>

      {}
      {mode === "idle" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY}>{"  Alvo (URL):"}</Text>
          <Box marginLeft={2}>
            <CursorTextInput
              field={urlField}
              setField={setUrlField}
              isActive={isFocused}
              color={FOCUS}
            />
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color={UNFOCUS} dimColor>{"  Enter → iniciar   q → fechar   Esc → desfoca"}</Text>
            <Text color={DIM} dimColor>{`  Porta padrão: ${DEFAULT_PORT}`}</Text>
          </Box>
        </Box>
      )}

      {}
      {mode === "running" && (
        <Box flexDirection="column" marginTop={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={MUTED}>{"  →"}</Text>
            <Text color={SECONDARY} bold wrap="truncate">{status.targetUrl ?? ""}</Text>
          </Box>
          {isFocused && (
            <Text color={UNFOCUS} dimColor>{"  s → parar   q → parar+fechar   Esc → desfoca"}</Text>
          )}
        </Box>
      )}

      {}
      <Box flexDirection="column" flexGrow={1} marginTop={1} overflow="hidden">
        {logLines.map((line, i) => (
          <Text key={i} color={logColor(line)} wrap="truncate">
            {"  " + line}
          </Text>
        ))}
      </Box>

      {}
      {!isFocused && (
        <Text color={DIM} dimColor>{"  [Tab → focar]"}</Text>
      )}
    </Box>
  );
};

