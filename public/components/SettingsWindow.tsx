import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { PRIMARY, SECONDARY, DANGER, DIM, ACCENT } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";

type SettingsMode = "menu" | "cowsay_figure" | "cowsay_message" | "cowsay_delay" | "menu_name" | "art_default";

interface SettingsWindowProps {
  id: string;
  isFocused: boolean;
  height: number;
  onClose: () => void;
  onBlur: () => void;
}

const SETTINGS_ITEMS = [
  { label: "Arte padrao", value: "art_default" },
  { label: "Cowsay: figura", value: "cowsay_figure" },
  { label: "Cowsay: mensagem", value: "cowsay_message" },
  { label: "Cowsay: delay (ms)", value: "cowsay_delay" },
  { label: "Nome do menu", value: "menu_name" },
  { label: "Voltar", value: "back" },
];

const FIGURES = ["tux", "kitty", "dragon", "elephant", "koala", "moose", "stegosaurus", "turtle", "default"];

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  id,
  isFocused,
  height,
  onClose,
  onBlur,
}) => {
  const { artService } = useServices();
  const cfg = artService.configService;

  const [mode, setMode] = useState<SettingsMode>("menu");
  const [cursor, setCursor] = useState(0);
  const [field, setField] = useState<CursorInputField>({ value: "", pos: 0 });
  const [saved, setSaved] = useState("");

  const showSaved = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(""), 2000);
  };

  useInput((input, key) => {
    if (!isFocused) return;

    if (mode === "menu") {
      if (key.upArrow) setCursor((p) => Math.max(0, p - 1));
      if (key.downArrow) setCursor((p) => Math.min(SETTINGS_ITEMS.length - 1, p + 1));
      if (key.return) {
        const item = SETTINGS_ITEMS[cursor];
        if (item.value === "back") {
          onClose();
          return;
        }
        if (item.value === "art_default") {
          setMode("art_default");
          setCursor(0);
          return;
        }
        if (item.value === "cowsay_figure") {
          setMode("cowsay_figure");
          setCursor(FIGURES.indexOf(cfg.art.cowsay.figure));
          if (cursor < 0) setCursor(0);
          return;
        }
        const val =
          item.value === "cowsay_message" ? cfg.art.cowsay.message
          : item.value === "cowsay_delay" ? String(cfg.art.cowsay.delay)
          : item.value === "menu_name" ? cfg.menu.name
          : "";
        setField({ value: val, pos: val.length });
        setMode(item.value as SettingsMode);
      }
      if (key.escape) onClose();
      return;
    }

    if (mode === "art_default") {
      const names = artService.terminal.providerNames;
      if (key.upArrow) setCursor((p) => Math.max(0, p - 1));
      if (key.downArrow) setCursor((p) => Math.min(names.length - 1, p + 1));
      if (key.return) {
        const name = names[cursor];
        cfg.updateDefaultArt(name);
        artService.switchArt(name);
        showSaved("Arte padrao: " + name);
        setMode("menu");
        setCursor(0);
      }
      if (key.escape) { setMode("menu"); setCursor(0); }
      return;
    }

    if (mode === "cowsay_figure") {
      if (key.upArrow) setCursor((p) => Math.max(0, p - 1));
      if (key.downArrow) setCursor((p) => Math.min(FIGURES.length - 1, p + 1));
      if (key.return) {
        cfg.updateCowsay(FIGURES[cursor]);
        artService.terminal.switchTo("cowsay");
        showSaved("Figura: " + FIGURES[cursor]);
        setMode("menu");
        setCursor(0);
      }
      if (key.escape) { setMode("menu"); setCursor(0); }
      return;
    }

    if (key.escape) { setMode("menu"); setCursor(0); return; }
    if (key.return) {
      if (mode === "cowsay_message") {
        cfg.updateCowsay(undefined, field.value);
        showSaved("Mensagem salva");
      } else if (mode === "cowsay_delay") {
        const d = parseInt(field.value, 10);
        if (d > 0) cfg.updateCowsay(undefined, undefined, d);
        showSaved("Delay: " + field.value + "ms");
      } else if (mode === "menu_name") {
        cfg.updateMenuName(field.value);
        showSaved("Nome do menu salvo");
      }
      setMode("menu");
      setCursor(0);
    }
  });

  if (mode === "menu") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={SECONDARY} bold>{"\u2699"} Configuracoes</Text>
        <Text> </Text>
        {SETTINGS_ITEMS.map((item, i) => (
          <Text key={item.value} color={i === cursor ? ACCENT : PRIMARY}>
            {i === cursor ? " > " : "   "}{item.label}
          </Text>
        ))}
        {saved && <><Text> </Text><Text color={ACCENT}>{saved}</Text></>}
      </Box>
    );
  }

  if (mode === "art_default") {
    const names = artService.terminal.providerNames;
    const current = cfg.art.default;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={SECONDARY} bold>Arte padrao</Text>
        <Text> </Text>
        {names.map((name, i) => (
          <Text key={name} color={i === cursor ? ACCENT : PRIMARY}>
            {i === cursor ? " > " : "   "}{name}{name === current ? " (atual)" : ""}
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM} dimColor>Enter = selecionar  |  Esc = voltar</Text>
      </Box>
    );
  }

  if (mode === "cowsay_figure") {
    const current = cfg.art.cowsay.figure;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={SECONDARY} bold>Figura cowsay</Text>
        <Text> </Text>
        {FIGURES.map((fig, i) => (
          <Text key={fig} color={i === cursor ? ACCENT : PRIMARY}>
            {i === cursor ? " > " : "   "}{fig}{fig === current ? " (atual)" : ""}
          </Text>
        ))}
        <Text> </Text>
        <Text color={DIM} dimColor>Enter = selecionar  |  Esc = voltar</Text>
      </Box>
    );
  }

  const label =
    mode === "cowsay_message" ? "Mensagem cowsay:"
    : mode === "cowsay_delay" ? "Delay (ms):"
    : mode === "menu_name" ? "Nome do menu:"
    : "";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={SECONDARY} bold>{label}</Text>
      <Text> </Text>
      <CursorTextInput field={field} setField={setField} isActive={isFocused} color={ACCENT} />
      <Text> </Text>
      <Text color={DIM} dimColor>Enter = salvar  |  Esc = cancelar</Text>
      {saved && <Text color={ACCENT}>{saved}</Text>}
    </Box>
  );
};
