import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PRIMARY, SECONDARY, DANGER, MAGENTA, DIM } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { WINDOW_REGISTRY } from "./WindowRegistry.js";
import { ArtCapture } from "./App.js";
import type { EmailCredentialDTO } from "../../src/application/email/dto/EmailCredentialDTO.js";

interface WindowArtProps {
  height: number;
  width: number;
  artCapture: ArtCapture;
  rightActiveSlot: number;
  rightDesktops: Record<number, ArtCapture>;
  isCapturedFocused: boolean;
  isDragTarget: boolean;
  credentials: EmailCredentialDTO[];
  onArtClose: () => void;
  onArtBlur: () => void;
  onCredentialsChanged: () => void;
}

export const WindowArt: React.FC<WindowArtProps> = ({
  height,
  width,
  artCapture,
  rightActiveSlot,
  rightDesktops,
  isCapturedFocused,
  isDragTarget,
  credentials,
  onArtClose,
  onArtBlur,
  onCredentialsChanged,
}) => {
  const { artService } = useServices();
  const [artIndex, setArtIndex] = useState(() => artService.getRandomIndex());

  useEffect(() => {
    if (artCapture) return;
    const frame = artService.terminal.current();
    const interval = setInterval(() => {
      artService.nextFrame();
      setArtIndex((prev) => prev + 1);
    }, frame.delay);
    return () => clearInterval(interval);
  }, [artCapture, artIndex]);


  const allSlots = [
    ...(artCapture ? [0] : []),
    ...Object.keys(rightDesktops).map(Number).sort((a, b) => a - b),
  ];
  const currentCapture = rightActiveSlot > 0 ? rightDesktops[rightActiveSlot] : artCapture;


  if (isDragTarget) {
    return (
      <Box
        borderStyle="double"
        borderColor={PRIMARY}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={height}
        width={width}
        flexShrink={0}
        overflow="hidden"
      >
        <Text color={PRIMARY} bold>
          {"▼ SOLTE AQUI ▼"}
        </Text>
        <Text color={PRIMARY} dimColor>
          {"capturar janela"}
        </Text>
      </Box>
    );
  }


  const slotBar = allSlots.length > 0 ? (
    <Box paddingX={1} gap={1}>
      <Text color={DIM}>{"RSP"}</Text>
      {allSlots.map((s) => {
        const active = s === rightActiveSlot;
        const color = active ? MAGENTA : s === 0 ? DIM : SECONDARY;
        return (
          <Text key={s} color={color} bold={active}>
            {active ? `[●${s}]` : `[${s}]`}
          </Text>
        );
      })}
      <Text color={DIM} dimColor>{"  X+N"}</Text>
    </Box>
  ) : null;


  if (currentCapture) {
    return (
      <Box
        flexDirection="column"
        height={height}
        width={width}
        flexShrink={0}
        overflow="hidden"
      >
        {slotBar}

        {(() => {
          const config = WINDOW_REGISTRY[currentCapture.type];
          if (!config) return null;
          const Component = config.component;
          const extra = config.extraProps?.() ?? {};
          return (
            <Component
              id={currentCapture.id}
              isFocused={isCapturedFocused}
              height={height - 1}
              credentials={credentials}
              onClose={onArtClose}
              onBlur={onArtBlur}
              onCredentialsChanged={onCredentialsChanged}
              {...extra}
            />
          );
        })()}
      </Box>
    );
  }


  return (
    <Box
      borderStyle="single"
      borderColor={DANGER}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height={height}
      width={width}
      flexShrink={0}
      overflow="hidden"
    >
      <Text color={DANGER} bold>
        {artService.getLogo()}
      </Text>
      <Text> </Text>
      <Text color={DANGER} bold>
        {artService.terminal.current().content}
      </Text>
    </Box>
  );
};

