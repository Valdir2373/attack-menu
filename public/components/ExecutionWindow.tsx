import React from "react";
import { Box, Text } from "ink";
import { PRIMARY, SECONDARY, DANGER, FOCUS, UNFOCUS, MUTED, DIM, WARNING, ACCENT } from "../theme.js";

export interface WindowDisplay {
  id: string;
  name: string;
  target: string;
  status: "running" | "stopped" | "error";
  logs: string[];
}

interface ExecutionWindowProps {
  window: WindowDisplay;
  height: number;
  isFocused: boolean;
}

const _getLogColor = (log: string): string => {
  if (log.includes("[ERROR]")) return DANGER;
  if (log.includes("[+]")) return SECONDARY;
  if (log.includes("[OK]")) return SECONDARY;
  if (log.includes("[x]")) return WARNING;
  if (log.includes("[>]")) return SECONDARY;
  if (log.includes("[◆]")) return SECONDARY;
  if (log.includes("[-]")) return WARNING;
  if (log.includes("[~]")) return ACCENT;
  return MUTED;
};

const STATUS_LABEL: Record<WindowDisplay["status"], string> = {
  running: "RUNNING",
  stopped: "STOPPED",
  error: "ERROR",
};

export const ExecutionWindow: React.FC<ExecutionWindowProps> = ({
  window: win,
  height,
  isFocused,
}) => {
  const borderColor = isFocused
    ? FOCUS
    : win.status === "error"
      ? DANGER
      : win.status === "running"
        ? DANGER
        : UNFOCUS;

  const borderStyle = isFocused
    ? "double"
    : win.status === "running"
      ? "double"
      : "single";

  const hintLines = isFocused ? 2 : 0;
  const maxLogs = Math.max(1, height - 4 - hintLines);
  const visibleLogs = win.logs.slice(-maxLogs);

  return (
    <Box
      borderStyle={borderStyle}
      borderColor={borderColor}
      flexDirection="column"
      flexGrow={1}
      height={height}
      paddingX={1}
      overflow="hidden"
    >
      {}
      <Box flexDirection="row" gap={1}>
        <Text color={borderColor} bold>
          {"◈"}
        </Text>
        <Text color={PRIMARY} bold>
          {win.name}
        </Text>
        <Text color={SECONDARY} dimColor>
          {win.target}
        </Text>
        <Text color={borderColor} bold>{`[${STATUS_LABEL[win.status]}]`}</Text>
        {isFocused && (
          <Text color={FOCUS} bold>
            {"[FOCUSED]"}
          </Text>
        )}
      </Box>

      {}
      <Text color={isFocused ? FOCUS : DIM}>{"─".repeat(40)}</Text>

      {}
      {visibleLogs.length === 0 ? (
        <Text color={FOCUS}>{"  iniciando..."}</Text>
      ) : (
        visibleLogs.map((log, i) => (
          <Text key={i} color={_getLogColor(log)}>
            {`  ${log}`}
          </Text>
        ))
      )}

      {}
      {isFocused && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={FOCUS} dimColor>
            {"  Tab → próxima janela com erro"}
          </Text>
          <Text color={DANGER} bold>
            {"  X → fechar esta janela"}
          </Text>
          <Text color={UNFOCUS} dimColor>
            {"  Esc → desfoca"}
          </Text>
        </Box>
      )}
    </Box>
  );
};

