import React, { useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { PRIMARY, SECONDARY, DANGER, FOCUS, UNFOCUS, MUTED, DIM, WARNING, ACCENT } from "../theme.js";
import type { EmailCredentialDTO } from "../../src/application/email/dto/EmailCredentialDTO.js";
import type { FetchedEmailDTO } from "../../src/application/email/dto/FetchedEmailDTO.js";
import type { EmailOutputDTO } from "../../src/application/email/dto/EmailOutputDTO.js";
import type { ImapEventDTO } from "../../src/application/email/dto/ImapEventDTO.js";
import { useServices } from "../services/ServicesContext.js";
import { FilesConfig } from "../../src/config/files.config.js";
import { CursorTextInput, CursorInputField } from "./CursorTextInput.js";
import { HackerSpinner } from "./HackerSpinner.js";
import {
  useWindowState,
  snapGet,
  snapSet,
  snapClear,
  cbSet,
  cbCall,
} from "../hooks/windowStore.js";


const EMPTY_FIELD: CursorInputField = { value: "", pos: 0 };
const DEFAULT_KW_FILE: CursorInputField = {
  value: "keywordEmail.txt",
  pos: "keywordEmail.txt".length,
};

const EMAIL_MENU = [
  { label: "Listen",       value: "listen"    as const, icon: "◈" },
  { label: "Enviar Email", value: "send"      as const, icon: "✉" },
  { label: "Adicionar",   value: "add_email" as const, icon: "✚" },
  { label: "Scrap",        value: "scrap"     as const, icon: "◆" },
  { label: "Fechar",       value: "close"     as const, icon: "×" },
];

const SCRAP_CONFIRM_OPTIONS = ["sim", "não"];


type Phase =
  | "menu"
  | "listen_select"
  | "listen_save_file"
  | "listen"
  | "listen_inbox_loading"
  | "listen_inbox"
  | "listen_inbox_view"
  | "listen_inbox_save"
  | "send_select_sender"
  | "send_to"
  | "send_subject"
  | "send_body"
  | "send_running"
  | "send_done"
  | "add_email"
  | "add_password"
  | "add_verifying"
  | "add_done"
  | "scrap_file_confirm"
  | "scrap_file_name"
  | "scrap_keywords"
  | "scrap_whitelist"
  | "scrap_blacklist"
  | "scrap_running"
  | "scrap_done";

interface EmailWindowProps {
  id: string;
  isFocused: boolean;
  height: number;
  credentials: EmailCredentialDTO[];
  onClose: () => void;
  onBlur: () => void;
  onCredentialsChanged: () => void;
}


const PHASE_LABEL: Record<Phase, string> = {
  menu:               "MENU",
  listen_select:      "LISTEN",
  listen_save_file:   "LISTEN",
  listen:               "LISTEN",
  listen_inbox_loading: "INBOX",
  listen_inbox:         "INBOX",
  listen_inbox_view:    "INBOX",
  listen_inbox_save:    "INBOX",
  send_select_sender: "ENVIAR",
  send_to:            "ENVIAR",
  send_subject:       "ENVIAR",
  send_body:          "ENVIAR",
  send_running:       "ENVIANDO...",
  send_done:          "ENVIAR",
  add_email:          "ADICIONAR",
  add_password:       "ADICIONAR",
  add_verifying:      "VERIFICANDO...",
  add_done:           "ADICIONAR",
  scrap_file_confirm: "SCRAP",
  scrap_file_name:    "SCRAP",
  scrap_keywords:     "SCRAP",
  scrap_whitelist:    "SCRAP",
  scrap_blacklist:    "SCRAP",
  scrap_running:      "SCRAPING...",
  scrap_done:         "SCRAP",
};

const getLogColor = (log: string): string => {
  if (log.includes("[ERROR]")) return DANGER;
  if (log.includes("[+]"))     return SECONDARY;
  if (log.includes("[OK]"))    return SECONDARY;
  if (log.includes("[x]"))     return WARNING;
  if (log.includes("[>]"))     return SECONDARY;
  if (log.includes("[◆]"))    return SECONDARY;
  if (log.includes("[-]"))     return WARNING;
  if (log.includes("[~]"))     return ACCENT;
  return MUTED;
};

const timestamp = () => new Date().toTimeString().slice(0, 8);


export const EmailWindow: React.FC<EmailWindowProps> = ({
  id,
  isFocused,
  height,
  credentials,
  onClose,
  onBlur,
  onCredentialsChanged,
}) => {
  const { emailController, keywordReader, fileStorage } = useServices();


  const [phase,      setPhase]      = useWindowState<Phase>(id, "phase",      "menu");
  const [cursor,     setCursor]     = useWindowState(id, "cursor",     0);
  const [logs,       setLogs]       = useWindowState<string[]>(id, "logs",    []);
  const [listenStatus, setListenStatus] = useWindowState<"running"|"stopped"|"error">(
    id, "listenStatus", "stopped",
  );
  const [listenErrorMsg, setListenErrorMsg] = useWindowState(id, "listenErrorMsg", "");
  const [selectedIdxs,    setSelectedIdxs]    = useWindowState<number[]>(id, "selectedIdxs", []);
  const [receivedEmails,  setReceivedEmails]  = useWindowState<FetchedEmailDTO[]>(id, "receivedEmails", []);
  const [inboxCursor,     setInboxCursor]     = useWindowState(id, "inboxCursor", 0);
  const [inboxSaveField,  setInboxSaveField]  = useWindowState<CursorInputField>(id, "inboxSaveField", EMPTY_FIELD);
  const [inboxViewScroll, setInboxViewScroll] = useWindowState(id, "inboxViewScroll", 0);
  const [inboxSaveMsg,    setInboxSaveMsg]    = useWindowState(id, "inboxSaveMsg", "");
  const [inboxFetchError, setInboxFetchError] = useWindowState(id, "inboxFetchError", "");


  const [sendSender,    setSendSender]    = useWindowState<EmailCredentialDTO|null>(id, "sendSender", null);
  const [sendTo,        setSendTo]        = useWindowState(id, "sendTo",     "");
  const [sendSubject,   setSendSubject]   = useWindowState(id, "sendSubject","");
  const [sendStatusMsg, setSendStatusMsg] = useWindowState(id, "sendStatusMsg","");
  const [resultMsg,     setResultMsg]     = useWindowState(id, "resultMsg",  "");


  const [sendToField,      setSendToField]      = useWindowState<CursorInputField>(id, "sendToField",      EMPTY_FIELD);
  const [sendSubjectField, setSendSubjectField] = useWindowState<CursorInputField>(id, "sendSubjectField", EMPTY_FIELD);
  const [sendBodyField,    setSendBodyField]    = useWindowState<CursorInputField>(id, "sendBodyField",    EMPTY_FIELD);


  const [addEmailInput,    setAddEmailInput]    = useWindowState(id, "addEmailInput",   "");
  const [addEmailField,    setAddEmailField]    = useWindowState<CursorInputField>(id, "addEmailField",    EMPTY_FIELD);
  const [addPasswordField, setAddPasswordField] = useWindowState<CursorInputField>(id, "addPasswordField", EMPTY_FIELD);


  const [saveFileField, setSaveFileField] = useWindowState<CursorInputField>(id, "saveFileField", EMPTY_FIELD);


  const [scrapFromFile,     setScrapFromFile]     = useWindowState(id, "scrapFromFile",     true);
  const [scrapConfirmIdx,   setScrapConfirmIdx]   = useWindowState(id, "scrapConfirmIdx",   0);
  const [scrapFileName,     setScrapFileName]     = useWindowState<CursorInputField>(id, "scrapFileName", DEFAULT_KW_FILE);
  const [scrapFileError,    setScrapFileError]    = useWindowState(id, "scrapFileError",    "");
  const [scrapKeywords,     setScrapKeywords]     = useWindowState<string[]>(id, "scrapKeywords", []);
  const [scrapKwField,      setScrapKwField]      = useWindowState<CursorInputField>(id, "scrapKwField", EMPTY_FIELD);
  const [scrapWhitelist,    setScrapWhitelist]    = useWindowState<string[]>(id, "scrapWhitelist", []);
  const [scrapWlField,      setScrapWlField]      = useWindowState<CursorInputField>(id, "scrapWlField", EMPTY_FIELD);
  const [scrapBlacklist,    setScrapBlacklist]    = useWindowState<string[]>(id, "scrapBlacklist", []);
  const [scrapBlField,      setScrapBlField]      = useWindowState<CursorInputField>(id, "scrapBlField", EMPTY_FIELD);
  const [scrapLogs,         setScrapLogs]         = useWindowState<string[]>(id, "scrapLogs", []);
  const [scrapResult,       setScrapResult]       = useWindowState(id, "scrapResult",       "");
  const [scrapKeywordsRemaining, setScrapKeywordsRemaining] = useWindowState<number|null>(id, "scrapKwRemaining", null);


  const [monitorEmails, setMonitorEmails] = useWindowState<EmailOutputDTO[]>(id, "monitorEmails", []);


  useEffect(() => {
    cbSet(id, "addLog", (msg: unknown) => {
      setLogs((prev) => [...prev, msg as string]);
    });
    return () => {
      cbSet(id, "addLog", (msg: unknown) => {
        const prev = snapGet<string[]>(id, "logs", []);
        snapSet(id, "logs", [...prev, msg as string]);
      });
    };
  }, [id, setLogs]);


  useEffect(() => {
    if (phase !== "listen") return;
    if (snapGet<boolean>(id, "monitorActive", false)) return;
    const cred = selectedIdxs.length > 0 ? credentials[selectedIdxs[0]] : credentials[0];
    if (!cred) {
      setListenErrorMsg("Nenhuma credencial selecionada");
      setListenStatus("error");
      return;
    }
    snapSet(id, "monitorActive", true);
    setListenErrorMsg("");
    setMonitorEmails([]);
    setLogs([`[>] Iniciando monitoramento para: ${cred.email}`]);
    setListenStatus("running");
    emailController.startMonitor(cred.email, cred.password, (email) => {
      setMonitorEmails((prev) => [...prev, email]);
    }).then((result) => {
      if (result.isFailure) {
        setListenErrorMsg(result.error);
        cbCall(id, "addLog", `[ERROR] ${result.error}`);
        setListenStatus("error");
        snapSet(id, "monitorActive", false);
      }
    }).catch((err: Error) => {
      setListenErrorMsg(err.message);
      cbCall(id, "addLog", `[ERROR] ${err.message}`);
      setListenStatus("error");
      snapSet(id, "monitorActive", false);
    });

  }, [phase, id]);


  const addScrapLog = useCallback((msg: string) => {
    setScrapLogs((prev) => [...prev, `[${timestamp()}] ${msg}`]);
  }, [setScrapLogs]);


  const handleClose = useCallback(async () => {
    await emailController.stopListen("").catch(() => {});
    await emailController.stopMonitor("").catch(() => {});
    snapSet(id, "monitorActive", false);
    snapClear(id);
    onClose();
  }, [id, onClose, emailController]);


  const startListenMulti = useCallback((creds: EmailCredentialDTO[], saveFile: string) => {
    setListenStatus("running");
    setLogs([]);
    setPhase("listen");

    for (const cred of creds) {
      const label = cred.email.split("@")[0];

      emailController.startListen(cred.email, cred.password, (event: ImapEventDTO) => {
        const msg = `[${timestamp()}][${label}] ${event.message}`;
        snapSet(id, "logs", [...snapGet<string[]>(id, "logs", []), msg]);
        cbCall(id, "addLog", msg);
        if (saveFile.trim()) {
          fileStorage.appendFile(saveFile.trim(), `${msg}\n`).catch(() => {});
        }
      }).then((result) => {
        if (result.isFailure) {
          const msg = `[ERROR][${label}] ${result.error}`;
          snapSet(id, "logs", [...snapGet<string[]>(id, "logs", []), msg]);
          cbCall(id, "addLog", msg);
          setListenStatus("error");
        }
      }).catch((err: Error) => {
        const msg = `[ERROR][${label}] ${err.message}`;
        snapSet(id, "logs", [...snapGet<string[]>(id, "logs", []), msg]);
        cbCall(id, "addLog", msg);
        setListenStatus("error");
      });
    }
  }, [id, setListenStatus, setLogs, setPhase, emailController, fileStorage]);

  const stopListen = useCallback(async () => {
    await emailController.stopListen("").catch(() => {});
    setListenStatus("stopped");
  }, [setListenStatus, emailController]);


  const sendEmail = useCallback(async (
    sender: EmailCredentialDTO,
    to: string,
    subject: string,
    body: string,
  ) => {
    setPhase("send_running");
    setSendStatusMsg("");
    setResultMsg("");
    try {
      const result = await emailController.sendEmail(sender.email, sender.password, to, subject, body, (msg) =>
        setSendStatusMsg(msg),
      );
      if (result.isFailure) {
        setResultMsg(`[ERROR] ${result.error}`);
      } else {
        setResultMsg("[OK] Email enviado com sucesso!");
      }
    } catch (err: any) {
      setResultMsg(`[ERROR] ${err.message}`);
    }
    setPhase("send_done");
  }, [setPhase, setSendStatusMsg, setResultMsg, emailController]);


  const verifyAndAdd = useCallback(async (email: string, password: string) => {
    setPhase("add_verifying");
    try {
      const verifyResult = await emailController.verifyCredential(email, password);
      if (verifyResult.isFailure) {
        setResultMsg(`[ERROR] ${verifyResult.error}`);
      } else if (verifyResult.value!.isValid) {
        const appendResult = await emailController.appendCredential(FilesConfig.emailCredentials, email, password);
        if (appendResult.isFailure) {
          setResultMsg(`[ERROR] ${appendResult.error}`);
        } else {
          setResultMsg(`[OK] ${email} adicionado com sucesso!`);
          onCredentialsChanged();
        }
      } else {
        setResultMsg(`[ERROR] Credenciais inválidas para ${email}`);
      }
    } catch (err: any) {
      setResultMsg(`[ERROR] ${err.message}`);
    }
    setPhase("add_done");
  }, [setPhase, setResultMsg, onCredentialsChanged, emailController]);


  const resetScrap = useCallback(() => {
    setScrapConfirmIdx(0);
    setScrapFromFile(true);
    setScrapFileName(DEFAULT_KW_FILE);
    setScrapFileError("");
    setScrapKeywords([]);
    setScrapKwField(EMPTY_FIELD);
    setScrapWhitelist([]);
    setScrapWlField(EMPTY_FIELD);
    setScrapBlacklist([]);
    setScrapBlField(EMPTY_FIELD);
    setScrapLogs([]);
    setScrapResult("");
    setScrapKeywordsRemaining(null);
  }, [
    setScrapConfirmIdx, setScrapFromFile, setScrapFileName, setScrapFileError,
    setScrapKeywords, setScrapKwField, setScrapWhitelist, setScrapWlField,
    setScrapBlacklist, setScrapBlField, setScrapLogs, setScrapResult, setScrapKeywordsRemaining,
  ]);

  const confirmKeywordFile = useCallback(async (filename: string) => {
    const kws = await keywordReader.read(filename);
    if (kws.length === 0) {
      setScrapFileError(`Arquivo "${filename}" vazio ou não encontrado`);
      return;
    }
    setScrapFileError("");
    setScrapKeywords(kws);
    setPhase("scrap_whitelist");
  }, [setScrapFileError, setScrapKeywords, setPhase, keywordReader]);

  const startScrap = useCallback(async (
    keywords: string[],
    wl: string[],
    bl: string[],
  ) => {
    setPhase("scrap_running");
    setScrapLogs([]);
    setScrapKeywordsRemaining(keywords.length);
    try {
      const result = await emailController.executeScrapValidate(
        keywords, wl, bl,
        addScrapLog,
        (remaining) => setScrapKeywordsRemaining(remaining),
      );
      if (result.isFailure) {
        setScrapResult(`[ERROR] ${result.error}`);
      } else {
        setScrapResult(`[OK] ${result.value!.scraped} scraped · ${result.value!.validated} validado(s)`);
      }
    } catch (err: any) {
      setScrapResult(`[ERROR] ${err.message}`);
    }
    setScrapKeywordsRemaining(null);
    setPhase("scrap_done");
    onCredentialsChanged();
  }, [addScrapLog, setPhase, setScrapLogs, setScrapKeywordsRemaining, setScrapResult, onCredentialsChanged, emailController]);


  useInput(
    (input, key) => {

      if (phase === "menu") {
        if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setCursor((i) => Math.min(EMAIL_MENU.length - 1, i + 1)); return; }
        if (key.escape)    { onBlur(); return; }
        if (key.return) {
          const item = EMAIL_MENU[cursor];
          if (item.value === "close") { handleClose(); return; }
          if (item.value === "listen") {
            if (credentials.length === 0) {
              setLogs([]);
              setLogs((p) => [...p, `[${timestamp()}] [ERROR] Nenhum email cadastrado`]);
              setPhase("listen"); setListenStatus("error");
              return;
            }
            if (credentials.length === 1) {
              setSelectedIdxs([0]);
              setPhase("listen");
              return;
            }
            setPhase("listen_select");
            setCursor(0);
            setSelectedIdxs([]);
            return;
          }
          if (item.value === "send") {
            if (credentials.length === 0) return;
            setSendSender(null); setSendTo(""); setSendSubject("");
            setSendStatusMsg(""); setResultMsg("");
            setSendToField(EMPTY_FIELD); setSendSubjectField(EMPTY_FIELD); setSendBodyField(EMPTY_FIELD);
            setPhase("send_select_sender");
            setCursor(0);
            return;
          }
          if (item.value === "add_email") {
            setAddEmailField(EMPTY_FIELD); setAddPasswordField(EMPTY_FIELD);
            setAddEmailInput(""); setResultMsg("");
            setPhase("add_email");
            return;
          }
          if (item.value === "scrap") {
            resetScrap();
            setPhase("scrap_file_confirm");
            return;
          }
        }
        return;
      }


      if (phase === "listen_select") {
        if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setCursor((i) => Math.min(credentials.length - 1, i + 1)); return; }
        if (key.escape)    { setPhase("menu"); setCursor(0); return; }
        if (input === " ") {
          setSelectedIdxs((prev) =>
            prev.includes(cursor)
              ? prev.filter((i) => i !== cursor)
              : [...prev, cursor],
          );
          return;
        }
        if (key.return) {
          const idxsToListen = selectedIdxs.length > 0 ? selectedIdxs : [cursor];
          setSelectedIdxs(idxsToListen);
          setPhase("listen");
          return;
        }
        return;
      }


      if (phase === "listen_save_file") {
        if (key.escape) { setPhase("listen_select"); return; }
        if (key.return) {
          setPhase("listen");
          return;
        }
        return;
      }


      if (phase === "listen") {
        if (key.return) {
          emailController.stopMonitor("").catch(() => {});
          snapSet(id, "monitorActive", false);
          setListenStatus("stopped");
          setInboxCursor(0);
          setInboxSaveMsg("");
          setPhase("listen_inbox");
          return;
        }
        if (input === "q" || input === "Q") {
          emailController.stopMonitor("").catch(() => {});
          snapSet(id, "monitorActive", false);
          setListenStatus("stopped");
          setPhase("menu");
          setCursor(0);
          return;
        }
        return;
      }

      if (phase === "listen_inbox_loading") return;


      if (phase === "listen_inbox") {
        if (key.upArrow)   { setInboxCursor((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setInboxCursor((i) => Math.min(Math.max(0, monitorEmails.length - 1), i + 1)); return; }
        if (key.return && monitorEmails.length > 0) {
          setInboxViewScroll(0);
          setInboxSaveMsg("");
          setPhase("listen_inbox_view");
          return;
        }
        if (input === "q" || input === "Q") { setPhase("menu"); setCursor(0); return; }
        return;
      }


      if (phase === "listen_inbox_view") {
        const bodyLines = monitorEmails[inboxCursor]?.content.split("\n") ?? [];
        if (key.upArrow)   { setInboxViewScroll((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setInboxViewScroll((i) => Math.min(Math.max(0, bodyLines.length - 1), i + 1)); return; }
        if (input === "s" || input === "S") {
          setInboxSaveField(EMPTY_FIELD);
          setInboxSaveMsg("");
          setPhase("listen_inbox_save");
          return;
        }
        if (key.escape || key.return) { setPhase("listen_inbox"); return; }
        return;
      }


      if (phase === "listen_inbox_save") {
        if (key.escape) { setPhase("listen_inbox_view"); return; }
        if (key.return) {
          const filename = inboxSaveField.value.trim();
          const email = monitorEmails[inboxCursor];
          if (filename && email) {
            const fileContent = `De: ${email.from}\nAssunto: ${email.about}\n\n${email.content}`;
            fs.writeFile(filename, fileContent + "\n").then(() => {
              setInboxSaveMsg(`[OK] Salvo em "${filename}"`);
            }).catch((err: Error) => {
              setInboxSaveMsg(`[ERROR] ${err.message}`);
            }).finally(() => {
              setPhase("listen_inbox_view");
            });
          } else {
            setPhase("listen_inbox_view");
          }
          return;
        }
        return;
      }


      if (phase === "send_select_sender") {
        if (key.upArrow)   { setCursor((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setCursor((i) => Math.min(credentials.length - 1, i + 1)); return; }
        if (key.escape)    { setPhase("menu"); setCursor(0); return; }
        if (key.return)    { setSendSender(credentials[cursor]); setPhase("send_to"); setSendToField(EMPTY_FIELD); return; }
        return;
      }


      if (phase === "send_to") {
        if (key.escape) { setPhase("send_select_sender"); setCursor(0); return; }
        if (key.return) {
          if (sendToField.value.trim()) {
            setSendTo(sendToField.value.trim());
            setPhase("send_subject");
            setSendSubjectField(EMPTY_FIELD);
          }
          return;
        }
        return;
      }


      if (phase === "send_subject") {
        if (key.escape) { setPhase("send_to"); return; }
        if (key.return) {
          if (sendSubjectField.value.trim()) {
            setSendSubject(sendSubjectField.value.trim());
            setPhase("send_body");
            setSendBodyField(EMPTY_FIELD);
          }
          return;
        }
        return;
      }


      if (phase === "send_body") {
        if (key.escape) { setPhase("send_subject"); return; }
        if (key.return) {
          if (sendBodyField.value.trim() && sendSender) {
            sendEmail(sendSender, sendTo, sendSubject, sendBodyField.value.trim());
          }
          return;
        }
        return;
      }

      if (phase === "send_running") return;
      if (phase === "send_done") {
        if (key.escape || key.return) {
          setPhase("menu"); setCursor(0);
          setSendSender(null); setSendTo(""); setSendSubject(""); setSendStatusMsg(""); setResultMsg("");
        }
        return;
      }


      if (phase === "add_email") {
        if (key.escape) { setPhase("menu"); setCursor(0); return; }
        if (key.return) {
          if (addEmailField.value.trim()) {
            setAddEmailInput(addEmailField.value.trim());
            setAddPasswordField(EMPTY_FIELD);
            setPhase("add_password");
          }
          return;
        }
        return;
      }


      if (phase === "add_password") {
        if (key.escape) { setPhase("add_email"); return; }
        if (key.return) {
          if (addPasswordField.value.trim()) verifyAndAdd(addEmailInput, addPasswordField.value.trim());
          return;
        }
        return;
      }

      if (phase === "add_verifying") return;
      if (phase === "add_done") {
        if (key.escape || key.return) { setPhase("menu"); setCursor(0); setResultMsg(""); }
        return;
      }


      if (phase === "scrap_file_confirm") {
        if (key.upArrow)   { setScrapConfirmIdx((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setScrapConfirmIdx((i) => Math.min(1, i + 1)); return; }
        if (key.escape)    { setPhase("menu"); setCursor(0); return; }
        if (key.return) {
          const useFile = scrapConfirmIdx === 0;
          setScrapFromFile(useFile);
          setPhase(useFile ? "scrap_file_name" : "scrap_keywords");
          return;
        }
        return;
      }

      if (phase === "scrap_file_name") {
        if (key.escape) { setPhase("scrap_file_confirm"); setScrapFileError(""); return; }
        if (key.return) {
          const filename = scrapFileName.value.trim() || "keywordEmail.txt";
          setScrapFileName({ value: filename, pos: filename.length });
          confirmKeywordFile(filename);
          return;
        }
        return;
      }

      if (phase === "scrap_keywords") {
        if (key.escape) { setPhase("scrap_file_confirm"); return; }
        if (key.return) {
          if (scrapKwField.value.trim() === "") {
            if (scrapKeywords.length === 0) { addScrapLog("[ERROR] Insira ao menos 1 keyword"); return; }
            setPhase("scrap_whitelist");
          } else {
            setScrapKeywords((ks) => [...ks, scrapKwField.value.trim()]);
            setScrapKwField(EMPTY_FIELD);
          }
          return;
        }
        return;
      }

      if (phase === "scrap_whitelist") {
        if (key.escape) {
          setPhase(scrapFromFile ? "scrap_file_name" : "scrap_keywords");
          return;
        }
        if (key.return) {
          if (scrapWlField.value.trim() === "") {
            setPhase("scrap_blacklist");
          } else {
            setScrapWhitelist((wl) => [...wl, scrapWlField.value.trim()]);
            setScrapWlField(EMPTY_FIELD);
          }
          return;
        }
        return;
      }

      if (phase === "scrap_blacklist") {
        if (key.escape) { setPhase("scrap_whitelist"); return; }
        if (key.return) {
          if (scrapBlField.value.trim() === "") {
            startScrap(scrapKeywords, scrapWhitelist, scrapBlacklist);
          } else {
            setScrapBlacklist((bl) => [...bl, scrapBlField.value.trim()]);
            setScrapBlField(EMPTY_FIELD);
          }
          return;
        }
        return;
      }

      if (phase === "scrap_running") return;

      if (phase === "scrap_done") {
        if (key.escape || key.return) {
          resetScrap();
          setPhase("menu");
          setCursor(0);
        }
        return;
      }
    },
    { isActive: isFocused },
  );


  const borderColor = isFocused
    ? FOCUS
    : phase === "listen" && listenStatus === "error"
      ? DANGER
      : phase === "listen" && listenStatus === "running"
        ? DANGER
        : UNFOCUS;

  const innerHeight = Math.max(1, height - 4);
  const listenLabel = phase === "listen" ? ` [${listenStatus.toUpperCase()}]` : "";


  const renderContent = () => {

    if (phase === "menu") {
      return (
        <Box flexDirection="column">
          {EMAIL_MENU.map((item, idx) => {
            const sel = idx === cursor;
            return (
              <Text key={item.value} color={sel ? PRIMARY : SECONDARY} bold={sel}>
                {`  ${sel ? "●" : "○"} ${item.icon} ${item.label}`}
              </Text>
            );
          })}
          {isFocused && <Text color={UNFOCUS} dimColor>{"  Esc → desfoca"}</Text>}
        </Box>
      );
    }

    if (phase === "listen_select") {
      return (
        <Box flexDirection="column">
          <Text color={UNFOCUS} dimColor>{"  Selecione emails (Espaço = toggle, Enter = confirmar):"}</Text>
          {credentials.map((c, idx) => {
            const sel = idx === cursor;
            const checked = selectedIdxs.includes(idx);
            return (
              <Text key={c.email} color={sel ? PRIMARY : SECONDARY} bold={sel}>
                {`  ${sel ? "●" : "○"} [${checked ? "x" : " "}] ✉ ${c.email}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>{"  Espaço = toggle · Enter = confirmar · Esc = voltar"}</Text>
        </Box>
      );
    }

    if (phase === "listen_save_file") {
      return (
        <Box flexDirection="column">
          <Text color={SECONDARY}>{"  Salvar emails em arquivo (vazio = não salvar):"}</Text>
          <Box marginTop={1} marginLeft={2}>
            <CursorTextInput
              field={saveFileField}
              setField={setSaveFileField}
              isActive={isFocused}
              color={FOCUS}
            />
          </Box>
          <Text color={UNFOCUS} dimColor marginTop={1}>{"  Enter → iniciar · Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "listen") {
      const hintLines = isFocused ? 2 : 0;
      const emailLines = Math.min(monitorEmails.length, 3);
      const logLines = Math.max(1, innerHeight - 3 - hintLines - emailLines - (monitorEmails.length > 0 ? 1 : 0));
      const visibleLogs = logs.slice(-logLines);
      const recentEmails = monitorEmails.slice(-3);
      return (
        <Box flexDirection="column">
          {listenStatus === "running"
            ? <HackerSpinner label={`Monitorando: ${credentials[selectedIdxs[0]]?.email ?? "?"}`} color={SECONDARY} />
            : listenStatus === "error"
              ? <Text color={DANGER}>{`  [ERROR] ${listenErrorMsg || "Falha ao conectar"}`}</Text>
              : <Text color={FOCUS}>{"  aguardando..."}</Text>
          }
          {monitorEmails.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={FOCUS}>{`  ✉ ${monitorEmails.length} email(s) recebido(s):`}</Text>
              {recentEmails.map((e, i) => (
                <Text key={i} color={PRIMARY} wrap="truncate">{`  · ${e.from}: ${e.about}`}</Text>
              ))}
            </Box>
          )}
          <Box flexDirection="column" marginTop={1}>
            {visibleLogs.map((log, i) => (
              <Text key={i} color={getLogColor(log)}>{`  ${log}`}</Text>
            ))}
          </Box>
          {isFocused && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={PRIMARY} bold>{"  Enter → ver caixa de entrada"}</Text>
              <Text color={UNFOCUS} dimColor>{"  q → menu de email · Esc → fechar"}</Text>
            </Box>
          )}
        </Box>
      );
    }

    if (phase === "listen_inbox_loading") {
      return (
        <Box flexDirection="column">
          <HackerSpinner label="Buscando emails do servidor..." color={SECONDARY} />
        </Box>
      );
    }

    if (phase === "listen_inbox") {
      const hasEmails = monitorEmails.length > 0;
      const hintLines = isFocused ? 1 : 0;
      const listHeight = Math.max(1, innerHeight - 2 - hintLines);
      const visibleEmails = monitorEmails.slice(
        Math.max(0, inboxCursor - listHeight + 1),
        Math.max(listHeight, inboxCursor + 1),
      );
      const visibleOffset = Math.max(0, inboxCursor - listHeight + 1);
      return (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{`  Inbox: ${monitorEmails.length} email(s)`}</Text>
          <Box flexDirection="column">
            {!hasEmails && <Text color={MUTED}>{"  Nenhum email coletado."}</Text>}
            {visibleEmails.map((email, i) => {
              const idx = i + visibleOffset;
              const sel = idx === inboxCursor;
              return (
                <Text key={idx} color={sel ? PRIMARY : MUTED} bold={sel} wrap="truncate">
                  {`  ${sel ? "●" : "○"} ${email.from} · ${email.about}`}
                </Text>
              );
            })}
          </Box>
          {isFocused && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={UNFOCUS} dimColor>{hasEmails ? "  Enter → ler · q → menu de email" : "  q → menu de email"}</Text>
            </Box>
          )}
        </Box>
      );
    }

    if (phase === "listen_inbox_view") {
      const email = monitorEmails[inboxCursor];
      if (!email) return <Text color={DANGER}>{"  Email não encontrado."}</Text>;
      const bodyLines = email.content.split("\n");
      const hintLines = isFocused ? (inboxSaveMsg ? 3 : 2) : 0;
      const visible = bodyLines.slice(inboxViewScroll, inboxViewScroll + Math.max(1, innerHeight - 4 - hintLines));
      return (
        <Box flexDirection="column">
          <Text color={MUTED} wrap="truncate">{`  De:      ${email.from}`}</Text>
          <Text color={MUTED} wrap="truncate">{`  Assunto: ${email.about}`}</Text>
          <Text color={DIM}>{"  " + "─".repeat(38)}</Text>
          <Box flexDirection="column">
            {visible.length === 0
              ? <Text color={MUTED}>{"  (sem conteúdo)"}</Text>
              : visible.map((line, i) => (
                  <Text key={i} color={PRIMARY} wrap="truncate">{`  ${line}`}</Text>
                ))
            }
          </Box>
          {isFocused && (
            <Box flexDirection="column" marginTop={1}>
              {inboxSaveMsg !== "" && (
                <Text color={inboxSaveMsg.includes("[OK]") ? PRIMARY : DANGER}>{`  ${inboxSaveMsg}`}</Text>
              )}
              <Text color={FOCUS}>{"  S → salvar este email"}</Text>
              <Text color={UNFOCUS} dimColor>{"  ↑↓ scroll · Enter/Esc → lista"}</Text>
            </Box>
          )}
        </Box>
      );
    }

    if (phase === "listen_inbox_save") {
      const email = monitorEmails[inboxCursor];
      return (
        <Box flexDirection="column">
          <Text color={MUTED} wrap="truncate">{`  Salvando: ${email?.about ?? "?"}`}</Text>
          <Text color={SECONDARY} marginTop={1}>{"  Nome do arquivo:"}</Text>
          <Box marginLeft={2} marginTop={1}>
            <CursorTextInput field={inboxSaveField} setField={setInboxSaveField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → salvar · Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "send_select_sender") {
      return (
        <Box flexDirection="column">
          <Text color={UNFOCUS} dimColor>{"  Selecione remetente:"}</Text>
          {credentials.map((c, idx) => {
            const sel = idx === cursor;
            return (
              <Text key={c.email} color={sel ? PRIMARY : SECONDARY} bold={sel}>
                {`  ${sel ? "●" : "○"} ✉ ${c.email}`}
              </Text>
            );
          })}
          <Text color={UNFOCUS} dimColor>{"  Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "send_to") {
      return (
        <Box flexDirection="column">
          {sendSender && <Text color={MUTED}>{`  De: ${sendSender.email}`}</Text>}
          <Text color={SECONDARY}>{"  Para: "}</Text>
          <Box marginLeft={4}>
            <CursorTextInput field={sendToField} setField={setSendToField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → próximo   Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "send_subject") {
      return (
        <Box flexDirection="column">
          {sendSender && <Text color={MUTED}>{`  De: ${sendSender.email}`}</Text>}
          <Text color={MUTED}>{`  Para: ${sendTo}`}</Text>
          <Text color={SECONDARY}>{"  Assunto: "}</Text>
          <Box marginLeft={4}>
            <CursorTextInput field={sendSubjectField} setField={setSendSubjectField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → próximo   Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "send_body") {
      return (
        <Box flexDirection="column">
          {sendSender && <Text color={MUTED}>{`  De: ${sendSender.email}`}</Text>}
          <Text color={MUTED}>{`  Para: ${sendTo}`}</Text>
          <Text color={MUTED}>{`  Assunto: ${sendSubject}`}</Text>
          <Text color={SECONDARY}>{"  Mensagem: "}</Text>
          <Box marginLeft={4}>
            <CursorTextInput field={sendBodyField} setField={setSendBodyField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → enviar   Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "send_running") {
      return <Text color={FOCUS}>{`  ${sendStatusMsg || "[>] Enviando..."}`}</Text>;
    }
    if (phase === "send_done") {
      const color = resultMsg.includes("[OK]") ? PRIMARY : DANGER;
      return (
        <Box flexDirection="column">
          <Text color={color}>{`  ${resultMsg}`}</Text>
          <Text color={UNFOCUS} dimColor>{"  Enter → voltar ao menu"}</Text>
        </Box>
      );
    }

    if (phase === "add_email") {
      return (
        <Box flexDirection="column">
          <Text color={SECONDARY}>{"  Email:"}</Text>
          <Box marginLeft={4}>
            <CursorTextInput field={addEmailField} setField={setAddEmailField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → próximo   Esc → cancelar"}</Text>
        </Box>
      );
    }
    if (phase === "add_password") {
      return (
        <Box flexDirection="column">
          <Text color={MUTED}>{`  Email: ${addEmailInput}`}</Text>
          <Text color={SECONDARY}>{"  Senha:"}</Text>
          <Box marginLeft={4}>
            <CursorTextInput field={addPasswordField} setField={setAddPasswordField} isActive={isFocused} color={FOCUS} mask="*" />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter → verificar   Esc → voltar"}</Text>
        </Box>
      );
    }
    if (phase === "add_verifying") {
      return (
        <Box flexDirection="column">
          <Text color={MUTED}>{`  Email: ${addEmailInput}`}</Text>
          <Text color={FOCUS}>{"  [>] Verificando credenciais..."}</Text>
        </Box>
      );
    }
    if (phase === "add_done") {
      const color = resultMsg.includes("[OK]") ? PRIMARY : DANGER;
      return (
        <Box flexDirection="column">
          <Text color={color}>{`  ${resultMsg}`}</Text>
          <Text color={UNFOCUS} dimColor>{"  Enter → voltar ao menu"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_file_confirm") {
      return (
        <Box flexDirection="column">
          <Text color={SECONDARY} bold>{"  Deseja usar arquivo de keywords?"}</Text>
          <Box marginTop={1} flexDirection="column">
            {SCRAP_CONFIRM_OPTIONS.map((opt, idx) => {
              const sel = idx === scrapConfirmIdx;
              return (
                <Text key={opt} color={sel ? PRIMARY : SECONDARY} bold={sel}>
                  {`  ${sel ? "●" : "○"} ${opt}`}
                </Text>
              );
            })}
          </Box>
          <Text color={UNFOCUS} dimColor marginTop={1}>{"  ↑↓ · Enter · Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_file_name") {
      return (
        <Box flexDirection="column">
          <Text color={SECONDARY}>{"  Qual arquivo de keywords?"}</Text>
          <Box marginTop={1} marginLeft={2}>
            <CursorTextInput field={scrapFileName} setField={setScrapFileName} isActive={isFocused} color={FOCUS} />
          </Box>
          {scrapFileError !== "" && (
            <Text color={DANGER}>{`  [ERROR] ${scrapFileError}`}</Text>
          )}
          <Text color={UNFOCUS} dimColor marginTop={1}>{"  Enter → confirmar   Esc → voltar"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_keywords") {
      return (
        <Box flexDirection="column">
          {scrapKeywords.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`  [${scrapKeywords.length}] Keywords:`}</Text>
              {scrapKeywords.map((kw, i) => (
                <Text key={i} color={ACCENT}>{`    ${i + 1}. ${kw}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"  > Keyword:"}</Text>
          <Box marginLeft={2}>
            <CursorTextInput field={scrapKwField} setField={setScrapKwField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter = adicionar  ·  Enter vazio = confirmar"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_whitelist") {
      return (
        <Box flexDirection="column">
          {scrapWhitelist.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`  [${scrapWhitelist.length}] Whitelist:`}</Text>
              {scrapWhitelist.map((w, i) => (
                <Text key={i} color={ACCENT}>{`    ${i + 1}. ${w}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"  > Extensão/padrão (whitelist):"}</Text>
          <Box marginLeft={2}>
            <CursorTextInput field={scrapWlField} setField={setScrapWlField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter = adicionar  ·  Enter vazio = próximo"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_blacklist") {
      return (
        <Box flexDirection="column">
          {scrapBlacklist.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color={SECONDARY}>{`  [${scrapBlacklist.length}] Blacklist:`}</Text>
              {scrapBlacklist.map((b, i) => (
                <Text key={i} color={WARNING}>{`    ${i + 1}. ${b}`}</Text>
              ))}
            </Box>
          )}
          <Text color={SECONDARY}>{"  > Padrão a ignorar (blacklist):"}</Text>
          <Box marginLeft={2}>
            <CursorTextInput field={scrapBlField} setField={setScrapBlField} isActive={isFocused} color={FOCUS} />
          </Box>
          <Text color={UNFOCUS} dimColor>{"  Enter = adicionar  ·  Enter vazio = INICIAR"}</Text>
        </Box>
      );
    }

    if (phase === "scrap_running") {
      const visibleLogs = scrapLogs.slice(-Math.max(1, innerHeight - 4));
      const spinnerLabel = scrapKeywordsRemaining === 0
        ? "Processando credenciais..."
        : scrapKeywordsRemaining !== null && scrapKeywordsRemaining > 0
          ? `Scraping em andamento... (${scrapKeywordsRemaining} restante(s))`
          : "Scraping em andamento...";
      return (
        <Box flexDirection="column">
          <HackerSpinner label={spinnerLabel} color={PRIMARY} />
          <Box flexDirection="column" marginTop={1}>
            <Text color={DIM} bold>{"  ─── LOG ───"}</Text>
            {visibleLogs.map((log, i) => (
              <Text key={i} color={getLogColor(log)}>{`  ${log}`}</Text>
            ))}
          </Box>
        </Box>
      );
    }

    if (phase === "scrap_done") {
      const color = scrapResult.includes("[ERROR]") ? DANGER : PRIMARY;
      return (
        <Box flexDirection="column">
          <Text color={color} bold>{`  ${scrapResult}`}</Text>
          <Text color={UNFOCUS} dimColor>{"  Enter → voltar ao menu"}</Text>
        </Box>
      );
    }

    return null;
  };


  return (
    <Box
      borderStyle="single"
      borderColor={borderColor}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      height={height}
      paddingX={1}
      overflow="hidden"
    >
      <Box flexDirection="row" gap={1}>
        <Text color={borderColor} bold>{"✉"}</Text>
        <Text color={PRIMARY} bold>{"EMAIL"}</Text>
        <Text color={SECONDARY} dimColor>{PHASE_LABEL[phase] + listenLabel}</Text>
        {isFocused && <Text color={FOCUS} bold>{"[FOCUSED]"}</Text>}
      </Box>

      <Text color={isFocused ? FOCUS : DIM}>{"─".repeat(40)}</Text>

      {renderContent()}
    </Box>
  );
};

