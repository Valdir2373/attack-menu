import React from "react";
import { Box, Text, useInput } from "ink";
import { PRIMARY, SECONDARY, FOCUS, UNFOCUS, MUTED, WARNING, ACCENT } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { FilesConfig } from "../../src/config/files.config.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import Spinner from "ink-spinner";
import { useWindowState } from "../hooks/windowStore.js";


const DEFAULT_SUPABASE_KEYWORDS = [
  "SUPABASE_URL=https supabase_anon_key",
  "SUPABASE_URL supabase.co",
  "createClient supabase.co eyJ",
  "supabase/supabase-js SUPABASE",
];

const EMPTY: CursorInputField = { value: "", pos: 0 };


type Mode =
  | "menu"
  | "massive_keywords"
  | "massive_whitelist"
  | "massive_blacklist"
  | "running";

interface SupabaseTestWindowProps {
  height: number;
  id: string;
  isFocused?: boolean;
  inputFile?: string;
  onBlur?: () => void;
  onClose?: () => void;
}


export const SupabaseTestWindow: React.FC<SupabaseTestWindowProps> = ({
  height,
  id,
  isFocused = false,
  inputFile = "supabase_results.txt",
  onBlur,
  onClose,
}) => {
  const { supabaseController } = useServices();

  const [isRunning,  setIsRunning]  = useWindowState(id, "isRunning",  false);
  const [logs,       setLogs]       = useWindowState<string[]>(id, "logs", []);
  const [tested,     setTested]     = useWindowState(id, "tested",     0);
  const [validated,  setValidated]  = useWindowState(id, "validated",  0);
  const [menuIndex,  setMenuIndex]  = useWindowState(id, "menuIndex",  0);
  const [mode,       setMode]       = useWindowState<Mode>(id, "mode", "menu");


  const [massiveKeywords,  setMassiveKeywords]  = useWindowState<string[]>(id, "massiveKeywords",  DEFAULT_SUPABASE_KEYWORDS);
  const [massiveWhitelist, setMassiveWhitelist] = useWindowState<string[]>(id, "massiveWhitelist", []);
  const [massiveBlacklist, setMassiveBlacklist] = useWindowState<string[]>(id, "massiveBlacklist", []);
  const [kwField,          setKwField]          = useWindowState<CursorInputField>(id, "kwField", EMPTY);
  const [wlField,          setWlField]          = useWindowState<CursorInputField>(id, "wlField", EMPTY);
  const [blField,          setBlField]          = useWindowState<CursorInputField>(id, "blField", EMPTY);

  const menuOptions = ["Validation Credentials", "Validation Massive", "Sair"];

  const appendLog = (msg: string) => setLogs((prev) => [...prev, msg]);


  const runValidation = async () => {
    setMode("running");
    setIsRunning(true);
    setLogs([]);
    setTested(0);
    setValidated(0);

    const result = await supabaseController.executeValidation(
      inputFile, FilesConfig.supabaseCredentials,
      appendLog,
    );
    const val = result.isSuccess ? result.value! : { tested: 0, validated: 0 };
    if (result.isFailure) appendLog(`[ERROR] ${result.error}`);

    setTested(val.tested);
    setValidated(val.validated);
    setIsRunning(false);
    setMode("menu");
  };


  const runMassive = async (kws: string[], wl: string[], bl: string[]) => {
    setMode("running");
    setIsRunning(true);
    setLogs([]);
    setTested(0);
    setValidated(0);

    const result = await supabaseController.executeMassive(
      kws, FilesConfig.supabaseCredentials,
      appendLog,
      wl.length > 0 ? wl : undefined,
      bl.length > 0 ? bl : undefined,
    );
    const val = result.isSuccess ? result.value! : { scraped: 0, validated: 0 };
    if (result.isFailure) appendLog(`[ERROR] ${result.error}`);

    setTested(val.scraped);
    setValidated(val.validated);
    setIsRunning(false);
    setMode("menu");
  };


  useInput((input, key) => {
    if (key.escape) {
      if (mode === "menu") { onBlur?.(); return; }
      setMode("menu");
      return;
    }


    if (mode === "menu") {
      if (key.upArrow)   { setMenuIndex((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setMenuIndex((i) => Math.min(menuOptions.length - 1, i + 1)); return; }
      if (key.return) {
        if (menuOptions[menuIndex] === "Validation Credentials") { runValidation(); return; }
        if (menuOptions[menuIndex] === "Validation Massive") {
          setMassiveKeywords([...DEFAULT_SUPABASE_KEYWORDS]);
          setMassiveWhitelist([]);
          setMassiveBlacklist([]);
          setKwField(EMPTY);
          setWlField(EMPTY);
          setBlField(EMPTY);
          setMode("massive_keywords");
          return;
        }
        if (menuOptions[menuIndex] === "Sair") { onClose?.(); return; }
      }
      return;
    }


    if (mode === "massive_keywords") {
      if (key.return) {
        if (kwField.value.trim() === "") {
          if (massiveKeywords.length === 0) { appendLog("[ERROR] Insira pelo menos 1 keyword"); return; }
          setMode("massive_whitelist");
        } else {
          setMassiveKeywords((ks) => [...ks, kwField.value.trim()]);
          setKwField(EMPTY);
        }
      }
      return;
    }


    if (mode === "massive_whitelist") {
      if (key.return) {
        if (wlField.value.trim() === "") {
          setMode("massive_blacklist");
        } else {
          setMassiveWhitelist((wl) => [...wl, wlField.value.trim()]);
          setWlField(EMPTY);
        }
      }
      return;
    }


    if (mode === "massive_blacklist") {
      if (key.return) {
        if (blField.value.trim() === "") {
          runMassive(massiveKeywords, massiveWhitelist, massiveBlacklist);
        } else {
          setMassiveBlacklist((bl) => [...bl, blField.value.trim()]);
          setBlField(EMPTY);
        }
      }
      return;
    }
  }, { isActive: isFocused });


  const displayLogs = logs.slice(-Math.max(6, Math.floor(height - 10)));

  return (
    <Box
      borderStyle={isFocused ? "double" : "round"}
      borderColor={isFocused ? FOCUS : UNFOCUS}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      height={height}
      paddingX={1}
      paddingY={0}
      overflow="hidden"
    >
      {}
      <Box flexDirection="row" gap={1}>
        <Text color={isFocused ? FOCUS : UNFOCUS} bold>
          {isRunning ? <><Spinner /> Supabase</> : "⚡ Supabase"}
        </Text>
        {isFocused && <Text color={FOCUS} bold>{"[FOCUSED]"}</Text>}
      </Box>

      {}
      {mode === "menu" && (
        <Box flexDirection="column" marginBottom={1}>
          {menuOptions.map((option, index) => {
            const selected = index === menuIndex;
            return (
              <Text key={option} color={selected ? FOCUS : MUTED}>
                {selected ? "→" : " "} {option}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>
            {isFocused ? "↑/↓ · Enter · Esc → desfoca" : "[Tab → focar]"}
          </Text>
        </Box>
      )}

      {}
      {mode === "massive_keywords" && (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{`[${massiveKeywords.length}] Keywords:`}</Text>
          {massiveKeywords.slice(-3).map((kw, i) => (
            <Text key={i} color={FOCUS}>{`  ${kw}`}</Text>
          ))}
          {massiveKeywords.length > 3 && <Text color={UNFOCUS}>{"  ..."}</Text>}
          <Text color={PRIMARY}>{"> Nova keyword:"}</Text>
          <CursorTextInput field={kwField} setField={setKwField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = confirmar  ·  Esc = voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "massive_whitelist" && (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{"Whitelist (opcional):"}</Text>
          {massiveWhitelist.map((w, i) => (
            <Text key={i} color={FOCUS}>{`  ${w}`}</Text>
          ))}
          <Text color={PRIMARY}>{"> Filtro (ex: .env, .js):"}</Text>
          <CursorTextInput field={wlField} setField={setWlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = próximo  ·  Esc = voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "massive_blacklist" && (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{"Blacklist (opcional):"}</Text>
          {massiveBlacklist.map((b, i) => (
            <Text key={i} color={WARNING}>{`  ${b}`}</Text>
          ))}
          <Text color={PRIMARY}>{"> Ignorar blocos com (ex: example, test):"}</Text>
          <CursorTextInput field={blField} setField={setBlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = INICIAR  ·  Esc = voltar"}</Text>
        </Box>
      )}

      {}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {displayLogs.map((log, i) => (
          <Text key={i} wrap="truncate" color={FOCUS}>
            {log}
          </Text>
        ))}
      </Box>

      {}
      <Box marginTop={0} flexDirection="column">
        <Text color={SECONDARY}>
          {mode === "running" && isRunning
            ? `Scrapeado: ${tested} | Validado: ${validated}`
            : `Testado: ${tested} | Validado: ${validated}`}
        </Text>
      </Box>
    </Box>
  );
};

