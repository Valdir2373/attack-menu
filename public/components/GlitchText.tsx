import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { PRIMARY } from "../theme.js";

interface GlitchTextProps {
  text: string;
  color?: string;
  speed?: number;
}

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  color = PRIMARY,
  speed = 100,
}) => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    if (displayText.length < text.length) {
      const timer = setTimeout(
        () => setDisplayText(text.slice(0, displayText.length + 1)),
        speed,
      );
      return () => clearTimeout(timer);
    }
  }, [displayText, text, speed]);

  return <Text color={color}>{displayText}</Text>;
};

