import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PRIMARY } from "../theme.js";

const simbol = "◆";
const SCAN_FRAMES = [
  `[${simbol}░░░░░░░░]`,
  `[░${simbol}░░░░░░░]`,
  `[░░${simbol}░░░░░░]`,
  `[░░░${simbol}░░░░░]`,
  `[░░░░${simbol}░░░░]`,
  `[░░░░░${simbol}░░░]`,
  `[░░░░░░${simbol}░░]`,
  `[░░░░░░░${simbol}░]`,
  `[░░░░░░░░${simbol}]`,
  `[░░░░░░░${simbol}░]`,
  `[░░░░░░${simbol}░░]`,
  `[░░░░░${simbol}░░░]`,
  `[░░░░${simbol}░░░░]`,
  `[░░░${simbol}░░░░░]`,
  `[░░${simbol}░░░░░░]`,
  `[░${simbol}░░░░░░░]`,
];

interface HackerSpinnerProps {
  label: string;
  color?: string;
}

export const HackerSpinner: React.FC<HackerSpinnerProps> = ({
  label,
  color = PRIMARY,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % SCAN_FRAMES.length),
      80,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={color} bold>
        {SCAN_FRAMES[frame]}
      </Text>
      <Text color={color}>{label}</Text>
    </Box>
  );
};

