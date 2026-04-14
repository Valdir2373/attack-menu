import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { PRIMARY, SECONDARY, UNFOCUS } from "../theme.js";

interface MenuPanelProps {
  height: number;
  isActive: boolean;
  onOpenEmail: () => void;
  onOpenWebScraper: () => void;
  onOpenMongoTest: () => void;
  onOpenSupabase: () => void;
  onOpenProxyReverse: () => void;
  onOpenRansom: () => void;
  onOpenC2:       () => void;
  onOpenSettings: () => void;
}

const MAIN_ITEMS = [
  { label: "Email",          value: "email",         icon: "\u2709 "    },
  { label: "Web Scraper",    value: "web-scraper",   icon: "\u25C8 "    },
  { label: "\uD83C\uDF43 Mongo", value: "mongo-test", icon: "\u2618\uFE0F" },
  { label: "Supabase",       value: "supabase",      icon: "\u26A1\uFE0F" },
  { label: "Proxy Reverse",  value: "proxy-reverse", icon: "\u21C4 "    },
  { label: "Ransom",         value: "ransom",        icon: "\u2620 "    },
  { label: "C2",             value: "c2",            icon: "\u2328 "    },
  { label: "Configuracoes",  value: "settings",      icon: "\u2699 "    },
  { label: "Sair",           value: "exit",          icon: "\u00D7 "    },
];

export const MenuPanel: React.FC<MenuPanelProps> = ({
  height,
  isActive,
  onOpenEmail,
  onOpenWebScraper,
  onOpenMongoTest,
  onOpenSupabase,
  onOpenProxyReverse,
  onOpenRansom,
  onOpenC2,
  onOpenSettings,
}) => {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setCursor((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((i) => Math.min(MAIN_ITEMS.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const item = MAIN_ITEMS[cursor];
        if (item.value === "exit") {
          exit();
          console.clear();
          return;
        }
        if (item.value === "email") {
          onOpenEmail();
          return;
        }
        if (item.value === "web-scraper") {
          onOpenWebScraper();
          return;
        }
        if (item.value === "mongo-test") {
          onOpenMongoTest();
          return;
        }
        if (item.value === "supabase") {
          onOpenSupabase();
          return;
        }
        if (item.value === "proxy-reverse") {
          onOpenProxyReverse();
          return;
        }
        if (item.value === "ransom") {
          onOpenRansom();
          return;
        }
        if (item.value === "c2") {
          onOpenC2();
          return;
        }
        if (item.value === "settings") {
          onOpenSettings();
          return;
        }
      }
    },
    { isActive },
  );

  return (
    <Box
      borderStyle="single"
      borderColor={PRIMARY}
      flexDirection="column"
      height={height}
      paddingX={1}
      flexShrink={1}
      overflow="hidden"
    >
      <Text color={PRIMARY} bold>
        {"☠    Terminal Attack Menu"}
      </Text>
      <Text color={UNFOCUS} dimColor>
        {"  ↑↓ · Enter · Tab → foca janela"}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {MAIN_ITEMS.map((item, idx) => {
          const sel = idx === cursor && isActive;
          const color = sel ? PRIMARY : isActive ? SECONDARY : UNFOCUS;
          return (
            <Box key={item.value} flexDirection="row">
              <Text color={color} bold={sel}>{`  ${sel ? "●" : "○"} `}</Text>
              <Text color={color} bold={sel} wrap="truncate">{`${item.icon}${item.label}`}</Text>
            </Box>
          );
        })}
      </Box>
      {!isActive && (
        <Text color={UNFOCUS} dimColor>
          {"  [janela focada — Esc para voltar]"}
        </Text>
      )}
    </Box>
  );
};

