import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { MenuItem } from "../types";
import { PRIMARY, SECONDARY, ACCENT } from "../theme.js";

interface HackerMenuProps {
  items: MenuItem[];
  title?: string;
  onSelect: (item: MenuItem) => void;
}

export const HackerMenu: React.FC<HackerMenuProps> = ({
  items,
  title = "SELECT OPERATION",
  onSelect,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    _handleInput(input, key);
  });

  const _handleInput = (input: string, key: any): void => {
    if (key.upArrow) {
      setSelectedIndex((i) => (i - 1 + items.length) % items.length);
    } else if (key.downArrow) {
      setSelectedIndex((i) => (i + 1) % items.length);
    } else if (input === "\r") {
      onSelect(items[selectedIndex]);
    }
  };

  const _buildItemLabel = (item: MenuItem, isSelected: boolean): string => {
    const icon = item.icon || "▶";
    const marker = isSelected ? "●" : "○";
    return `${marker} ${icon} ${item.label}`;
  };

  return (
    <Box flexDirection="column" marginBottom={2}>
      <Text color={SECONDARY} bold>{`⚙ ${title}`}</Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, idx) => (
          <Text
            key={item.value}
            color={idx === selectedIndex ? PRIMARY : SECONDARY}
            bold={idx === selectedIndex}
          >
            {_buildItemLabel(item, idx === selectedIndex)}
          </Text>
        ))}
      </Box>
      <Text color={ACCENT} marginTop={1} dimColor>
        ↑/↓ Navigate • Enter Select
      </Text>
    </Box>
  );
};

