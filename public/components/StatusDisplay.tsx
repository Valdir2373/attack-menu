import React, { useState } from "react";
import { Box, Text } from "ink";
import { PRIMARY, SECONDARY, DANGER, FOCUS } from "../theme.js";

interface StatusDisplayProps {
  message: string;
  status: "active" | "success" | "error" | "loading";
}

const STATUS_COLORS = {
  active: SECONDARY,
  success: PRIMARY,
  error: DANGER,
  loading: FOCUS,
};

const STATUS_ICONS = {
  active: "[◆]",
  success: "[✓]",
  error: "[✗]",
  loading: "[◈]",
};

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  message,
  status,
}) => {
  const color = STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];

  return (
    <Box marginY={1}>
      <Text color={color} bold>
        {icon}
      </Text>
      <Text color={color} marginLeft={1}>
        {message}
      </Text>
    </Box>
  );
};

