import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PRIMARY } from "../theme.js";

interface MatrixCharProps {
  char: string;
  opacity: number;
}

const MatrixChar: React.FC<MatrixCharProps> = ({ char, opacity }) => {
  const dimColor = opacity < 0.5;
  return (
    <Text color={PRIMARY} dimColor={dimColor}>
      {char}
    </Text>
  );
};

export const MatrixBackground: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const [chars, setChars] = useState<string[]>([]);

  useEffect(() => {
    const generateChars = (): void => {
      const newChars = Array.from({ length: width }, () =>
        _generateRandomChar(),
      );
      setChars(newChars);
    };

    generateChars();
    const interval = setInterval(generateChars, 500);
    return () => clearInterval(interval);
  }, [width]);

  return (
    <Box>
      {chars.map((char, i) => (
        <MatrixChar key={i} char={char} opacity={Math.random()} />
      ))}
    </Box>
  );
};

const _generateRandomChar = (): string => {
  const chars = ["█", "▓", "▒", "░", "▐", "▌", "▄", "▀", "├", "┤"];
  return chars[Math.floor(Math.random() * chars.length)];
};

