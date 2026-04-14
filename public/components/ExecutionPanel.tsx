import React from "react";
import { Box, Text } from "ink";
import { PRIMARY, SECONDARY, DANGER, FOCUS, MUTED, DIM, WARNING, ACCENT } from "../theme.js";

export interface ActiveProcess {
  name: string;
  target: string;
}

interface ExecutionPanelProps {
  process: ActiveProcess | null;
  logs: string[];
  height: number;
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

const _IdleState: React.FC = () => (
  <Box flexDirection="column" paddingX={1} paddingY={1}>
    <Text color={DIM}>{"  nenhum processo ativo"}</Text>
    <Text color={DIM} dimColor>
      {"  ative algo no menu para iniciar uma execução"}
    </Text>
  </Box>
);

const _ProcessHeader: React.FC<{ proc: ActiveProcess }> = ({ proc }) => (
  <Box flexDirection="row" gap={2}>
    <Text color={DANGER} bold>
      {"◈"}
    </Text>
    <Text color={PRIMARY} bold>
      {proc.name}
    </Text>
    <Text color={SECONDARY}>{proc.target}</Text>
    <Text color={DANGER} bold>
      {"[RUNNING]"}
    </Text>
  </Box>
);

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  process,
  logs,
  height,
}) => {
  const isActive = process !== null;

  const maxVisible = Math.max(1, height - 4);
  const visible = logs.slice(-maxVisible);

  return (
    <Box
      borderStyle={isActive ? "double" : "single"}
      borderColor={isActive ? DANGER : DIM}
      flexDirection="column"
      height={height}
      paddingX={1}
    >
      {isActive ? (
        <_ProcessHeader proc={process} />
      ) : (
        <Text color={DIM} bold>
          {"○ EXECUTION PANEL"}
        </Text>
      )}

      <Box
        borderStyle="single"
        borderColor={isActive ? DIM : DIM}
        marginTop={0}
      />

      {!isActive ? (
        <_IdleState />
      ) : (
        <Box flexDirection="column">
          {visible.length === 0 ? (
            <Text color={FOCUS}>{"  iniciando..."}</Text>
          ) : (
            visible.map((log, i) => (
              <Text key={i} color={_getLogColor(log)}>
                {`  ${log}`}
              </Text>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

