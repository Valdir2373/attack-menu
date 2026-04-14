import React from "react";
import { Box, Text } from "ink";
import { PRIMARY, SECONDARY } from "../theme.js";

const BANNER = `
╔═══════════════════════════════════════════╗
║         ⚡ ATTACK MENU HACKER ⚡          ║
║     System Access Terminal v2.0.1        ║
╚═══════════════════════════════════════════╝
`;

export const Header: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={PRIMARY} bold>
        {BANNER}
      </Text>
      <Text color={SECONDARY} dimColor>
        {`[${new Date().toLocaleTimeString()}] System Online`}
      </Text>
    </Box>
  );
};

