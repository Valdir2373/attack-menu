import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { OpenWindow } from "./App.js";
import { PRIMARY, SECONDARY, FOCUS } from "../theme.js";

const ICONS: Record<OpenWindow["type"], string> = {
  email: "✉",
  "web-scraper": "◈",
  "mongo-test": "☘",
};

const NAMES: Record<OpenWindow["type"], string> = {
  email: "EMAIL",
  "web-scraper": "SCRAPER",
  "mongo-test": "MONGO",
};


const HOLD_FRAMES = ["▓░░", "░▓░", "░░▓", "░▓░"];
const DROP_FRAMES = ["[DROP]", "[DROP!]", "[DROP!!]", "[DROP!]"];
const SWAP_FRAMES = ["TROCAR", "TROCAR!", "TROCAR!!", "TROCAR!"];

interface DragGhostProps {
  type: OpenWindow["type"];
  x: number;
  y: number;
  isOverTarget: boolean;
  isOverSwap?: boolean;
}

export const DragGhost: React.FC<DragGhostProps> = ({
  type,
  x,
  y,
  isOverTarget,
  isOverSwap = false,
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((i) => (i + 1) % 4), 130);
    return () => clearInterval(t);
  }, []);

  const color = isOverSwap ? SECONDARY : isOverTarget ? PRIMARY : FOCUS;
  const borderStyle = (isOverSwap || isOverTarget) ? "double" : "single";
  const anim = isOverSwap ? SWAP_FRAMES[tick] : isOverTarget ? DROP_FRAMES[tick] : HOLD_FRAMES[tick];

  return (
    <Box position="absolute" marginTop={y} marginLeft={x}>
      <Box borderStyle={borderStyle} borderColor={color} paddingX={1}>
        <Text color={color} bold>
          {ICONS[type]} {NAMES[type]} {anim}
        </Text>
      </Box>
    </Box>
  );
};

