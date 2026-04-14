import React from "react";
import { Box, Text } from "ink";

interface ScannerProps {
  target: string;
}

export const NetworkScanner: React.FC<ScannerProps> = ({ target }) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="#00FF00" bold>
        🔍 Iniciando Network Scan
      </Text>
      <Text color="#00FFFF">{`Target: ${target}`}</Text>
      <Text color="#FFFF00" dimColor>
        [...] Scanning ports...
      </Text>
    </Box>
  );
};

const _executeNetworkScan = (target: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(`Scan completo para ${target}`), 2000);
  });
};

/*
const MENU_ITEMS: MenuItem[] = [
  
  { label: 'Network Scanner', value: 'scan', icon: '🔍' },
];


const _handleNetworkScan = (): void => {
  
};
*/

interface PayloadGeneratorProps {
  apiClient: any;
}

export const PayloadGenerator: React.FC<PayloadGeneratorProps> = ({
  apiClient,
}) => {
  const _buildPayload = (): string => {
    return `payload_${Date.now()}`;
  };

  return (
    <Box marginY={1}>
      <Text color="#FF0000">💣 Payload: {_buildPayload()}</Text>
    </Box>
  );
};
