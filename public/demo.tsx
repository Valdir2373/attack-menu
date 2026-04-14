#!/usr/bin/env node

/**
 * DEMO - Attack Menu Hacker CLI
 *
 * Este arquivo demonstra todos os componentes em ação
 * Execute com: npx tsx src/demo.tsx
 */

import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import { Header } from "./components/Header";
import { HackerMenu } from "./components/HackerMenu";
import { StatusDisplay } from "./components/StatusDisplay";
import { GlitchText } from "./components/GlitchText";
import { MenuItem } from "./types";

const Demo: React.FC = () => {
  const [demoStep, setDemoStep] = useState(0);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDemoStep((s) => s + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [demoStep]);

  const MENU_ITEMS: MenuItem[] = [
    { label: "Network Scanner", value: "scan", icon: "🔍" },
    { label: "Payload Generator", value: "payload", icon: "💣" },
    { label: "Session Manager", value: "session", icon: "🔐" },
    { label: "Data Exfiltration", value: "exfil", icon: "📤" },
    { label: "Proxy Settings", value: "proxy", icon: "🌐" },
    { label: "System Info", value: "sysinfo", icon: "ℹ" },
  ];

  const _renderDemoContent = (): React.ReactNode => {
    switch (demoStep) {
      case 0:
        return <Header />;
      case 1:
        return (
          <Box flexDirection="column">
            <Header />
            <HackerMenu items={MENU_ITEMS} onSelect={setSelectedItem} />
          </Box>
        );
      case 2:
        return (
          <Box flexDirection="column">
            <Header />
            <StatusDisplay
              message="Scanning network 192.168.1.0/24"
              status="loading"
            />
            <StatusDisplay message="Found 12 active hosts" status="success" />
          </Box>
        );
      case 3:
        return (
          <Box flexDirection="column">
            <Header />
            <Box marginY={1}>
              <GlitchText
                text="Connecting to target server..."
                color="#00FF00"
                speed={30}
              />
            </Box>
            <StatusDisplay message="Connection established" status="success" />
          </Box>
        );
      case 4:
        return (
          <Box flexDirection="column" marginY={1}>
            <Text color="#FF0000" bold>
              ⚠ ALERT
            </Text>
            <Text color="#FF0000">Intrusion detected on port 22</Text>
            <StatusDisplay message="Firewall rules updated" status="error" />
          </Box>
        );
      default:
        return (
          <Box flexDirection="column">
            <Text color="#00FF00">
              Demo completo! Execute npm start para usar
            </Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {_renderDemoContent()}
      <Box marginTop={2} paddingTop={1}>
        <Text
          color="#00FFFF"
          dimColor
        >{`[Demo: Step ${demoStep}/5] Próxima mudança em 3s...`}</Text>
      </Box>
    </Box>
  );
};

render(<Demo />);
