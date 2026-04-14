import React from "react";
import { Box, Text } from "ink";
import { SECONDARY, FOCUS, MAGENTA, DIM, UNFOCUS } from "../theme.js";
import { OpenWindow, PackedDesktop } from "./App.js";
import type { EmailCredentialDTO } from "../../src/application/email/dto/EmailCredentialDTO.js";
import { WINDOW_REGISTRY } from "./WindowRegistry.js";

const COLUMNS = 2;

interface WindowsPanelProps {
  windows: OpenWindow[];
  credentials: EmailCredentialDTO[];
  height: number;
  focusedWindowId: string | null;
  activeSlot: number;
  packedDesktops: PackedDesktop[];
  draggingWindowId: string | null;
  onCloseWindow: (id: string) => void;
  onBlurWindow: () => void;
  onCredentialsChanged: () => void;
}

const _DesktopBar: React.FC<{
  activeSlot: number;
  packedDesktops: PackedDesktop[];
}> = ({ activeSlot, packedDesktops }) => {
  const slots = [0, ...packedDesktops.map((d) => d.slot)].sort((a, b) => a - b);

  return (
    <Box flexDirection="row" paddingX={1} gap={1}>
      <Text color={DIM}>{"WSP"}</Text>
      {slots.map((s) => {
        const active = s === activeSlot;
        const color = active ? FOCUS : s === 0 ? DIM : SECONDARY;
        return (
          <Text key={s} color={color} bold={active}>
            {active ? `[●${s}]` : `[${s}]`}
          </Text>
        );
      })}
      <Text color={DIM} dimColor>
        {"  Ctrl/Alt+N"}
      </Text>
    </Box>
  );
};

const _EmptyState: React.FC<{ height: number }> = ({ height }) => (
  <Box
    borderStyle="single"
    borderColor={DIM}
    flexGrow={1}
    height={height}
    alignItems="center"
    justifyContent="center"
    flexDirection="column"
  >
    <Text color={DIM}>{"sem janelas ativas"}</Text>
    <Text color={DIM} dimColor>
      {"abra Email ou Web Scraper no menu"}
    </Text>
  </Box>
);

const _DragPlaceholder: React.FC<{ height: number }> = ({ height }) => (
  <Box
    borderStyle="double"
    borderColor={FOCUS}
    flexGrow={1}
    height={height}
    alignItems="center"
    justifyContent="center"
    flexDirection="column"
    overflow="hidden"
  >
    <Text color={FOCUS} bold>{"◈ ARRASTANDO..."}</Text>
    <Text color={UNFOCUS} dimColor>{"solte no painel direito"}</Text>
  </Box>
);

export const WindowsPanel: React.FC<WindowsPanelProps> = ({
  windows,
  credentials,
  height,
  focusedWindowId,
  activeSlot,
  packedDesktops,
  draggingWindowId,
  onCloseWindow,
  onBlurWindow,
  onCredentialsChanged,
}) => {
  const BAR_HEIGHT = 1;
  const winAreaHeight = height - BAR_HEIGHT;

  const rows: OpenWindow[][] = [];
  for (let i = 0; i < windows.length; i += COLUMNS) {
    rows.push(windows.slice(i, i + COLUMNS));
  }
  const numRows = Math.max(1, rows.length);
  const rowHeight = Math.floor(winAreaHeight / numRows);

  return (
    <Box flexDirection="column" height={height} width="100%">
      <_DesktopBar activeSlot={activeSlot} packedDesktops={packedDesktops} />

      {windows.length === 0 ? (
        <_EmptyState height={winAreaHeight} />
      ) : (
        rows.map((rowWindows, rowIdx) => (
          <Box key={rowIdx} flexDirection="row" height={rowHeight} width="100%">
            {rowWindows.map((win) => {
              if (win.id === draggingWindowId) {
                return (
                  <_DragPlaceholder key={win.id} height={rowHeight} />
                );
              }
              const config = WINDOW_REGISTRY[win.type];
              if (!config) return null;
              const Component = config.component;
              const extra = config.extraProps?.() ?? {};
              return (
                <Component
                  key={win.id}
                  id={win.id}
                  isFocused={win.id === focusedWindowId}
                  height={rowHeight}
                  credentials={credentials}
                  onClose={() => onCloseWindow(win.id)}
                  onBlur={onBlurWindow}
                  onCredentialsChanged={onCredentialsChanged}
                  {...extra}
                />
              );
            })}
          </Box>
        ))
      )}
    </Box>
  );
};

