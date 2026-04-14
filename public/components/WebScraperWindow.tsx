import React, { useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { PRIMARY, SECONDARY, DANGER, FOCUS, UNFOCUS, MUTED, DIM, WARNING, ACCENT } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { FilesConfig } from "../../src/config/files.config.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import { useWindowState } from "../hooks/windowStore.js";


type Phase =
  | "menu"
  | "github_file_confirm"
  | "github_file_name"
  | "github_keywords"
  | "github_output_file"
  | "github_whitelist"
  | "github_blacklist"
  | "github_running"
  | "github_done";

interface WebScraperWindowProps {
  id: string;
  isFocused: boolean;
  height: number;
  onClose: () => void;
  onBlur: () => void;
}

const EMPTY: CursorInputField = { value: "", pos: 0 };

const SUB_MENU = [
  { label: "GitHub", icon: "◈" },
  { label: "Fechar", icon: "×" },
];

const logColor = (log: string): string => {
  if (log.includes("[ERROR]")) return DANGER;
  if (log.includes("[+]") || log.includes("[OK]")) return SECONDARY;
  if (log.includes("[x]") || log.includes("[-]")) return WARNING;
  if (log.includes("[>]")) return SECONDARY;
  if (log.includes("[◆]")) return SECONDARY;
  if (log.includes("[~]")) return ACCENT;
  return MUTED;
};

const ts = () => new Date().toTimeString().slice(0, 8);


export const WebScraperWindow: React.FC<WebScraperWindowProps> = ({
  id,
  isFocused,
  height,
  onClose,
  onBlur,
}) => {
  const { scraperController, keywordReader } = useServices();
  const serviceRef = useRef(scraperController);

  const [phase,          setPhase]          = useWindowState<Phase>(id, "phase",          "menu");
  const [menuIdx,        setMenuIdx]        = useWindowState(id, "menuIdx",        0);
  const [githubFromFile, setGithubFromFile] = useWindowState(id, "githubFromFile", true);
  const [githubFileName, setGithubFileName] = useWindowState<CursorInputField>(id, "githubFileName", {
    value: "keywordEmail.txt",
    pos: "keywordEmail.txt".length,
  });
  const [githubFileError, setGithubFileError] = useWindowState(id, "githubFileError", "");
  const [keywords,  setKeywords]  = useWindowState<string[]>(id, "keywords",  []);
  const [kwField,   setKwField]   = useWindowState<CursorInputField>(id, "kwField",   EMPTY);
  const [outField,  setOutField]  = useWindowState<CursorInputField>(id, "outField",  {
    value: FilesConfig.githubResults,
    pos: FilesConfig.githubResults.length,
  });
  const [whitelist, setWhitelist] = useWindowState<string[]>(id, "whitelist", []);
  const [wlField,   setWlField]   = useWindowState<CursorInputField>(id, "wlField",   EMPTY);
  const [blacklist, setBlacklist] = useWindowState<string[]>(id, "blacklist", []);
  const [blField,   setBlField]   = useWindowState<CursorInputField>(id, "blField",   EMPTY);
  const [logs,      setLogs]      = useWindowState<string[]>(id, "logs",      [
    "[~] Web Scraper — sub-opções: GitHub, …",
  ]);
  const [result,    setResult]    = useWindowState(id, "result",    "");

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-20), `[${ts()}] ${msg}`]);
  }, [setLogs]);

  const reset = useCallback(() => {
    setKeywords([]);
    setKwField(EMPTY);
    setOutField({ value: "github_results.txt", pos: "github_results.txt".length });
    setWhitelist([]);
    setWlField(EMPTY);
    setBlacklist([]);
    setBlField(EMPTY);
    setGithubFromFile(true);
    setGithubFileName({ value: "keywordEmail.txt", pos: "keywordEmail.txt".length });
    setGithubFileError("");
  }, [
    setKeywords, setKwField, setOutField, setWhitelist, setWlField,
    setBlacklist, setBlField, setGithubFromFile, setGithubFileName, setGithubFileError,
  ]);

  const confirmKeywordFile = useCallback(async (filename: string) => {
    try {
      const kws = await keywordReader.read(filename);
      if (kws.length === 0) {
        setGithubFileError(`Arquivo "${filename}" vazio ou não encontrado`);
        return false;
      }
      setGithubFileError("");
      setKeywords(kws);
      addLog(`[+] ${kws.length} keyword(s) carregada(s) de ${filename}`);
      return true;
    } catch {
      setGithubFileError(`Arquivo "${filename}" não encontrado`);
      return false;
    }
  }, [addLog, setGithubFileError, setKeywords, keywordReader]);

  const handleFileConfirm = useCallback(async (filename: string) => {
    const success = await confirmKeywordFile(filename);
    if (success) setPhase("github_output_file");
  }, [confirmKeywordFile, setPhase]);

  const startScrape = useCallback(async (kws: string[], out: string, wl: string[], bl: string[]) => {
    setPhase("github_running");
    addLog(`[>] Iniciando: ${kws.length} keyword(s)`);
    try {
      const result = await serviceRef.current.execute(
        kws, out,
        wl.length > 0 ? wl : undefined,
        bl.length > 0 ? bl : undefined,
      );
      const found = result.isSuccess ? result.value! : 0;
      if (result.isFailure) addLog(`[ERROR] ${result.error}`);
      else addLog(`[+] Concluído: ${found} resultado(s) salvos em ${out}`);
      setResult(`${found} resultado(s) → ${out}`);
    } catch (err: any) {
      addLog(`[ERROR] ${err.message}`);
      setResult("");
    }
    setPhase("github_done");
    reset();
  }, [addLog, reset, setPhase, setResult]);


  useInput(
    (input, key) => {

      if (phase === "menu") {
        if (key.escape) { onBlur(); return; }
        if (key.upArrow)   { setMenuIdx((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setMenuIdx((i) => Math.min(SUB_MENU.length - 1, i + 1)); return; }
        if (key.return) {
          if (menuIdx === 0) {
            reset();
            setPhase("github_file_confirm");
            addLog("[>] GitHub: escolher fonte de keywords");
          } else {
            onClose();
          }
        }
        return;
      }


      if (phase === "github_file_confirm") {
        if (key.escape) { setPhase("menu"); setMenuIdx(0); return; }
        if (key.upArrow || key.downArrow) { setGithubFromFile((i) => !i); return; }
        if (key.return) {
          setPhase(githubFromFile ? "github_file_name" : "github_keywords");
          if (!githubFromFile) addLog("[>] GitHub: keywords (Enter = adicionar, Enter vazio = confirmar)");
          return;
        }
        return;
      }


      if (phase === "github_file_name") {
        if (key.escape) { setPhase("github_file_confirm"); setGithubFileError(""); return; }
        if (key.return) {
          const filename = githubFileName.value.trim() || "keywordEmail.txt";
          setGithubFileName({ value: filename, pos: filename.length });
          handleFileConfirm(filename);
          return;
        }
        return;
      }


      if (phase === "github_keywords") {
        if (key.escape) { setPhase("github_file_confirm"); return; }
        if (key.return) {
          if (kwField.value.trim() === "") {
            if (keywords.length === 0) { addLog("[ERROR] Insira pelo menos 1 keyword"); return; }
            setPhase("github_output_file");
            addLog(`[+] ${keywords.length} keyword(s) confirmada(s)`);
          } else {
            setKeywords((ks) => [...ks, kwField.value.trim()]);
            setKwField(EMPTY);
          }
          return;
        }
        return;
      }


      if (phase === "github_output_file") {
        if (key.escape) { setPhase("github_keywords"); return; }
        if (key.return) {
          const val = outField.value.trim() || "github_results.txt";
          setOutField({ value: val, pos: val.length });
          setPhase("github_whitelist");
          addLog(`[+] Output: ${val}`);
          return;
        }
        return;
      }


      if (phase === "github_whitelist") {
        if (key.escape) { setPhase("github_output_file"); return; }
        if (key.return) {
          if (wlField.value.trim() === "") {
            setPhase("github_blacklist");
            addLog(`[+] Whitelist: ${whitelist.length > 0 ? whitelist.join(", ") : "padrão"}`);
          } else {
            setWhitelist((wl) => [...wl, wlField.value.trim()]);
            setWlField(EMPTY);
          }
          return;
        }
        return;
      }


      if (phase === "github_blacklist") {
        if (key.escape) { setPhase("github_whitelist"); return; }
        if (key.return) {
          if (blField.value.trim() === "") {
            startScrape(keywords, outField.value, whitelist, blacklist);
          } else {
            setBlacklist((bl) => [...bl, blField.value.trim()]);
            setBlField(EMPTY);
          }
          return;
        }
        return;
      }


      if (phase === "github_done") {
        if (key.escape) { onBlur(); return; }
        if (key.return) { setPhase("menu"); setMenuIdx(0); setResult(""); }
        return;
      }
    },
    { isActive: isFocused },
  );


  const logLines = logs.slice(-Math.max(3, height - 14));

  const phaseLabel: Record<Phase, string> = {
    menu: "SUB-MENU",
    github_file_confirm: "FILE CONFIRM",
    github_file_name: "FILE NAME",
    github_keywords: "KEYWORDS",
    github_output_file: "OUTPUT",
    github_whitelist: "WHITELIST",
    github_blacklist: "BLACKLIST",
    github_running: "SCRAPING...",
    github_done: "DONE",
  };

  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? SECONDARY : UNFOCUS}
      flexDirection="column"
      height={height}
      paddingX={1}
      flexShrink={1}
      overflow="hidden"
    >
      <Box flexDirection="row" marginBottom={1}>
        <Text color={SECONDARY} bold>{"◆ WEB SCRAPER"}</Text>
        <Box marginLeft={2}>
          <Text color={MUTED}>{phaseLabel[phase]}</Text>
        </Box>
      </Box>

      {phase === "menu" && (
        <Box flexDirection="column">
          <Text color={UNFOCUS} dimColor>{"  Sub-opções:"}</Text>
          {SUB_MENU.map((item, idx) => {
            const sel = idx === menuIdx && isFocused;
            return (
              <Text key={item.label} color={sel ? PRIMARY : isFocused ? SECONDARY : UNFOCUS} bold={sel}>
                {`  ${sel ? "●" : "○"} ${item.icon} ${item.label}`}
              </Text>
            );
          })}
        </Box>
      )}

      {phase === "github_file_confirm" && (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{"  Deseja usar arquivo de keywords?"}</Text>
          <Box marginTop={1} flexDirection="column">
            {[{ label: "Sim (arquivo)", value: true }, { label: "Não (digitar manual)", value: false }].map((opt, idx) => {
              const sel = (idx === 0) === githubFromFile && isFocused;
              return (
                <Text key={opt.label} color={sel ? PRIMARY : isFocused ? SECONDARY : UNFOCUS} bold={sel}>
                  {`  ${sel ? "●" : "○"} ${opt.label}`}
                </Text>
              );
            })}
          </Box>
          <Text color={UNFOCUS} dimColor marginTop={1}>{"  ↑↓ · Enter · Esc → voltar"}</Text>
        </Box>
      )}

      {phase === "github_file_name" && (
        <Box flexDirection="column">
          <Text color={SECONDARY}>{"  Qual arquivo de keywords?"}</Text>
          <Box marginTop={1} marginLeft={2}>
            <CursorTextInput field={githubFileName} setField={setGithubFileName} isActive={isFocused} color={FOCUS} />
          </Box>
          {githubFileError !== "" && (
            <Text color={DANGER}>{`  [ERROR] ${githubFileError}`}</Text>
          )}
          <Text color={UNFOCUS} dimColor marginTop={1}>{"  Enter → confirmar  ·  Esc → voltar"}</Text>
        </Box>
      )}

      {phase === "github_keywords" && (
        <Box flexDirection="column">
          {keywords.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`[${keywords.length}] Keywords:`}</Text>
              {keywords.map((kw, i) => (
                <Text key={i} color={ACCENT}>{`  ${i + 1}. ${kw}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"> Keyword:"}</Text>
          <CursorTextInput field={kwField} setField={setKwField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = confirmar"}</Text>
        </Box>
      )}

      {phase === "github_output_file" && (
        <Box flexDirection="column">
          <Text color={SECONDARY}>{"> Output file:"}</Text>
          <CursorTextInput field={outField} setField={setOutField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter vazio = github_results.txt"}</Text>
        </Box>
      )}

      {phase === "github_whitelist" && (
        <Box flexDirection="column">
          {whitelist.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`[${whitelist.length}] Whitelist:`}</Text>
              {whitelist.map((w, i) => (
                <Text key={i} color={ACCENT}>{`  ${i + 1}. ${w}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"> Extensão/arquivo (whitelist):"}</Text>
          <CursorTextInput field={wlField} setField={setWlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = próximo"}</Text>
        </Box>
      )}

      {phase === "github_blacklist" && (
        <Box flexDirection="column">
          {blacklist.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`[${blacklist.length}] Blacklist:`}</Text>
              {blacklist.map((b, i) => (
                <Text key={i} color={WARNING}>{`  ${i + 1}. ${b}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"> Padrão a ignorar (blacklist):"}</Text>
          <CursorTextInput field={blField} setField={setBlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>{"Enter = adicionar  ·  Enter vazio = INICIAR"}</Text>
        </Box>
      )}

      {phase === "github_running" && (
        <Box flexDirection="column">
          <Text color={FOCUS} bold>{"⟳ Scraping em andamento..."}</Text>
        </Box>
      )}

      {phase === "github_done" && (
        <Box flexDirection="column">
          {result !== "" && <Text color={PRIMARY} bold>{`[OK] ${result}`}</Text>}
          <Text color={UNFOCUS} dimColor>{"Enter = voltar ao menu"}</Text>
        </Box>
      )}

      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        <Text color={DIM} bold>{"─── LOG ───"}</Text>
        {logLines.map((log, i) => (
          <Text key={i} color={logColor(log)}>{log}</Text>
        ))}
      </Box>

      {!isFocused && (
        <Text color={UNFOCUS} dimColor>{"[Esc] focar"}</Text>
      )}
    </Box>
  );
};

