import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useStdout, useInput } from "ink";
import { MenuPanel } from "./MenuPanel.js";
import { WindowsPanel } from "./WindowsPanel.js";
import { WindowArt } from "./WindowArt.js";
import { DragGhost } from "./DragGhost.js";
import { useMouse } from "../hooks/useMouse.js";
import type { EmailCredentialDTO } from "../../src/application/email/dto/EmailCredentialDTO.js";
import { AppServices, ServicesContext } from "../services/ServicesContext.js";
import { FilesConfig } from "../../src/config/files.config.js";
const ART_ID = "__sexy__";

export const LAYOUT = {
  appSize: 80,
  artPanelRatio: 0.35,
  menuHeightRatio: 0.45,
};

export const WINDOWS_PER_DESKTOP = 4;

export type OpenWindow =
  | { id: string; type: "email" }
  | { id: string; type: "web-scraper" }
  | { id: string; type: "mongo-test" }
  | { id: string; type: "supabase" }
  | { id: string; type: "proxy-reverse" }
  | { id: string; type: "ransom" }
  | { id: string; type: "c2" }
  | { id: string; type: "settings" };

export interface PackedDesktop {
  slot: number;
  windows: OpenWindow[];
}

export type ArtCapture = {
  id: string;
  type: OpenWindow["type"];
} | null;

let _windowCounter = 0;

export const App: React.FC<{ services: AppServices }> = ({ services }) => {
  const { stdout } = useStdout();


  const xHeldRef = useRef(false);
  const xTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mouseActive, setMouseActive] = useState(false);

  const xNavRef = useRef(false);

  const mouse = useMouse(mouseActive);

  const termRows = stdout.rows;
  const termCols = stdout.columns;

  const pct = Math.min(100, Math.max(10, LAYOUT.appSize)) / 100;
  const appHeight = Math.floor(termRows * pct);
  const appWidth = Math.floor(termCols * pct);
  const artWidth = Math.floor(appWidth * LAYOUT.artPanelRatio);
  const leftWidth = appWidth - artWidth;

  const menuHeight = Math.floor(appHeight * LAYOUT.menuHeightRatio);
  const windowsHeight = appHeight - menuHeight;

  const padTop = Math.floor((termRows - appHeight) / 2);
  const padLeft = Math.floor((termCols - appWidth) / 2);


  const [currentWindows, setCurrentWindows] = useState<OpenWindow[]>([]);
  const [packedDesktops, setPackedDesktops] = useState<PackedDesktop[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [credentials, setCredentials] = useState<EmailCredentialDTO[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);


  const [rightActiveSlot, setRightActiveSlot] = useState(0);
  const [rightDesktops, setRightDesktops] = useState<Record<number, ArtCapture>>({});


  const [dragState, setDragState] = useState<{
    windowId: string;
    windowType: OpenWindow["type"];
    source: "window" | "art";
  } | null>(null);

  const [artCapture, setArtCapture] = useState<ArtCapture>(null);


  const currentWindowsRef = useRef(currentWindows);
  const packedDesktopsRef = useRef(packedDesktops);
  const activeSlotRef = useRef(activeSlot);
  const dragStateRef = useRef(dragState);
  const artCaptureRef = useRef(artCapture);
  const rightActiveSlotRef = useRef(rightActiveSlot);
  const rightDesktopsRef = useRef(rightDesktops);
  const wasPressedRef = useRef(false);

  // Mantém rawModeEnabledCount >= 1 o tempo todo para que stdin.unref()
  // nunca seja chamado durante transições de foco entre janelas (bug do Ink 5).
  useInput(() => {}, { isActive: true });

  currentWindowsRef.current = currentWindows;
  packedDesktopsRef.current = packedDesktops;
  activeSlotRef.current = activeSlot;
  dragStateRef.current = dragState;
  artCaptureRef.current = artCapture;
  rightActiveSlotRef.current = rightActiveSlot;
  rightDesktopsRef.current = rightDesktops;

  const visibleWindows =
    activeSlot === 0
      ? currentWindows
      : (packedDesktops.find((d) => d.slot === activeSlot)?.windows ?? []);

  const visibleWindowsRef = useRef(visibleWindows);
  visibleWindowsRef.current = visibleWindows;


  const getWindowAtPos = useCallback(
    (mx: number, my: number): OpenWindow | null => {
      if (mx < padLeft || mx >= padLeft + leftWidth) return null;
      if (my < padTop + menuHeight || my >= padTop + appHeight) return null;

      const wins = visibleWindowsRef.current;
      if (wins.length === 0) return null;

      const numRows = Math.max(1, Math.ceil(wins.length / 2));
      const rowH = Math.max(1, Math.floor(windowsHeight / numRows));
      const colW = Math.max(1, Math.floor(leftWidth / 2));

      const row = Math.floor((my - (padTop + menuHeight)) / rowH);
      const col = Math.floor((mx - padLeft) / colW);
      const idx = row * 2 + col;

      return wins[idx] ?? null;
    },
    [padLeft, padTop, leftWidth, appHeight, menuHeight, windowsHeight],
  );

  const isOverArtPanel = useCallback(
    (mx: number, my: number): boolean =>
      mx >= padLeft + leftWidth &&
      mx < padLeft + appWidth &&
      my >= padTop &&
      my < padTop + appHeight,
    [padLeft, padTop, leftWidth, appWidth, appHeight],
  );

  const isOverWindowsPanel = useCallback(
    (mx: number, my: number): boolean =>
      mx >= padLeft &&
      mx < padLeft + leftWidth &&
      my >= padTop + menuHeight &&
      my < padTop + appHeight,
    [padLeft, padTop, leftWidth, menuHeight, appHeight],
  );


  const loadCredentials = useCallback(() => {
    services.emailController
      .readCredentials(FilesConfig.emailCredentials)
      .then((result) => { if (result.isSuccess) setCredentials(result.value!); })
      .catch(() => {});
  }, [services.emailController]);

  const handleCloseWindow = useCallback((id: string) => {
    const slot = activeSlotRef.current;

    if (slot === 0) {
      setCurrentWindows((prev) => prev.filter((w) => w.id !== id));
    } else {
      const updated = packedDesktopsRef.current
        .map((d) =>
          d.slot === slot
            ? { ...d, windows: d.windows.filter((w) => w.id !== id) }
            : d,
        )
        .filter((d) => d.windows.length > 0);

      setPackedDesktops(updated);
      if (!updated.some((d) => d.slot === slot)) {
        setActiveSlot(0);
      }
    }

    setFocusedWindowId((prev) => (prev === id ? null : prev));
  }, []);

  const handleBlurWindow = useCallback(() => {
    setFocusedWindowId(null);
  }, []);


  const handleArtClose = useCallback(() => {
    if (rightActiveSlotRef.current > 0) {
      setRightDesktops((prev) => {
        const updated = { ...prev };
        delete updated[rightActiveSlotRef.current];
        return updated;
      });
    } else {
      setArtCapture(null);
    }
    setFocusedWindowId(null);
  }, []);


  const addWindowToDesktop = useCallback((type: OpenWindow["type"]) => {
    const id = String(++_windowCounter);
    const newWin: OpenWindow = { id, type };
    const slot = activeSlotRef.current;

    if (slot === 0) {

      setCurrentWindows((prev) => [...prev, newWin]);
    } else {
      const desktop = packedDesktopsRef.current.find((d) => d.slot === slot);
      if (desktop && desktop.windows.length < WINDOWS_PER_DESKTOP) {
        setPackedDesktops((prev) =>
          prev.map((d) =>
            d.slot === slot ? { ...d, windows: [...d.windows, newWin] } : d,
          ),
        );
      } else {

        setActiveSlot(0);
        setCurrentWindows((prev) => [...prev, newWin]);
      }
    }

    setFocusedWindowId(id);
  }, []);


  useEffect(() => {
    const wasPressed = wasPressedRef.current;

    if (mouse.isPressed && !wasPressed) {
      if (!dragStateRef.current) {
        const win = getWindowAtPos(mouse.x, mouse.y);
        if (win) {
          setDragState({
            windowId: win.id,
            windowType: win.type,
            source: "window",
          });
        } else if (isOverArtPanel(mouse.x, mouse.y) && artCaptureRef.current) {
          const cap = artCaptureRef.current;
          setArtCapture(null);
          setDragState({
            windowId: cap.id,
            windowType: cap.type,
            source: "art",
          });
        }
      }
    }

    if (!mouse.isPressed && wasPressed) {
      if (dragStateRef.current) {
        const ds = dragStateRef.current;
        if (ds.source === "window" && isOverArtPanel(mouse.x, mouse.y)) {

          const usedSlots = new Set([
            ...(artCaptureRef.current ? [0] : []),
            ...Object.keys(rightDesktopsRef.current).map(Number),
          ]);
          const nextSlot = [0,1,2,3,4,5,6,7,8,9].find(s => !usedSlots.has(s)) ?? 0;

          if (nextSlot === 0) {
            setArtCapture({ id: ds.windowId, type: ds.windowType });
          } else {
            setRightDesktops((prev) => ({
              ...prev,
              [nextSlot]: { id: ds.windowId, type: ds.windowType },
            }));
          }
          setRightActiveSlot(nextSlot);
          handleCloseWindow(ds.windowId);
        } else if (ds.source === "window") {
          const targetWin = getWindowAtPos(mouse.x, mouse.y);
          if (targetWin && targetWin.id !== ds.windowId) {
            const slot = activeSlotRef.current;
            if (slot === 0) {
              setCurrentWindows((prev) => {
                const a = prev.findIndex((w) => w.id === ds.windowId);
                const b = prev.findIndex((w) => w.id === targetWin.id);
                if (a === -1 || b === -1) return prev;
                const next = [...prev];
                [next[a], next[b]] = [next[b], next[a]];
                return next;
              });
            } else {
              setPackedDesktops((prev) =>
                prev.map((d) => {
                  if (d.slot !== slot) return d;
                  const wins = [...d.windows];
                  const a = wins.findIndex((w) => w.id === ds.windowId);
                  const b = wins.findIndex((w) => w.id === targetWin.id);
                  if (a === -1 || b === -1) return d;
                  [wins[a], wins[b]] = [wins[b], wins[a]];
                  return { ...d, windows: wins };
                }),
              );
            }
          }
        } else if (ds.source === "art" && isOverWindowsPanel(mouse.x, mouse.y)) {
          setArtCapture(null);
          addWindowToDesktop(ds.windowType);
        } else if (ds.source === "art") {
          setArtCapture({ id: ds.windowId, type: ds.windowType });
        }
        setDragState(null);
      }
    }

    wasPressedRef.current = mouse.isPressed;
  }, [
    mouse,
    getWindowAtPos,
    isOverArtPanel,
    isOverWindowsPanel,
    handleCloseWindow,
    addWindowToDesktop,
  ]);


  useInput((input, key) => {
    if (key.tab) {
      const ids = visibleWindowsRef.current.map((w) => w.id);
      if (artCapture) ids.push(ART_ID);
      if (ids.length === 0) return;
      setFocusedWindowId((prev) => {
        const idx = prev ? ids.indexOf(prev) : -1;
        return ids[(idx + 1) % ids.length];
      });
      return;
    }

    if (key.escape) {
      if (artCapture && focusedWindowId === ART_ID) {
        setFocusedWindowId(null);
      }
      return;
    }

    if (key.ctrl || key.meta) {
      const num = parseInt(input, 10);
      if (isNaN(num) || num < 0 || num > 9) return;

      if (num === 0) {
        setActiveSlot(0);
        setFocusedWindowId(null);
        return;
      }

      const exists = packedDesktopsRef.current.some((d) => d.slot === num);
      if (exists) {
        setActiveSlot(num);
        setFocusedWindowId(null);
      }
      return;
    }


    if (input === "x" || input === "X") {

      if (!xHeldRef.current) {
        xHeldRef.current = true;
        setMouseActive(true);
      }
      if (xTimeoutRef.current) clearTimeout(xTimeoutRef.current);
      xTimeoutRef.current = setTimeout(() => {
        xHeldRef.current = false;
        setMouseActive(false);
      }, 800);

      xNavRef.current = true;
      return;
    }


    if (xNavRef.current && input >= "0" && input <= "9") {
      xNavRef.current = false;
      const num = parseInt(input, 10);
      setRightActiveSlot(num);
      setFocusedWindowId(null);
      return;
    }


    xNavRef.current = false;
  });


  useEffect(() => {
    return () => { if (xTimeoutRef.current) clearTimeout(xTimeoutRef.current); };
  }, []);


  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const openWindow = useCallback((type: OpenWindow["type"]) => {
    const id = String(++_windowCounter);
    const newWin: OpenWindow = { id, type };
    const currLen = currentWindowsRef.current.length;

    if (currLen >= WINDOWS_PER_DESKTOP) {
      const topack = currentWindowsRef.current;
      setPackedDesktops((prev) => {
        const used = new Set(prev.map((d) => d.slot));
        const nextSlot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((s) => !used.has(s));
        if (nextSlot === undefined) return prev;
        return [...prev, { slot: nextSlot, windows: topack }];
      });
      setCurrentWindows([newWin]);
    } else {
      setCurrentWindows((prev) => [...prev, newWin]);
    }

    setActiveSlot(0);
    setFocusedWindowId(id);
  }, []);

  const handleOpenEmail = useCallback(() => openWindow("email"), [openWindow]);
  const handleOpenWebScraper = useCallback(
    () => openWindow("web-scraper"),
    [openWindow],
  );
  const handleOpenMongoTest = useCallback(
    () => openWindow("mongo-test"),
    [openWindow],
  );
  const handleOpenSupabase = useCallback(
    () => openWindow("supabase"),
    [openWindow],
  );
  const handleOpenProxyReverse = useCallback(
    () => openWindow("proxy-reverse"),
    [openWindow],
  );
  const handleOpenRansom = useCallback(
    () => openWindow("ransom"),
    [openWindow],
  );
  const handleOpenC2 = useCallback(
    () => openWindow("c2"),
    [openWindow],
  );


  const ghostOverPanel =
    dragState?.source === "window" && isOverArtPanel(mouse.x, mouse.y);
  const ghostOverWindows =
    dragState?.source === "art" && isOverWindowsPanel(mouse.x, mouse.y);
  const ghostOverTarget = ghostOverPanel || ghostOverWindows;
  const _hoverWin = dragState?.source === "window" ? getWindowAtPos(mouse.x, mouse.y) : null;
  const ghostOverSwap = !!_hoverWin && _hoverWin.id !== dragState?.windowId && !ghostOverPanel;

  return (
    <ServicesContext.Provider value={services}>
    <Box width={termCols} height={termRows}>
      <Box paddingTop={padTop} paddingLeft={padLeft}>
        <Box flexDirection="row" width={appWidth} height={appHeight}>
          <Box flexDirection="column" width={leftWidth} height={appHeight}>
            <MenuPanel
              height={menuHeight}
              isActive={focusedWindowId === null}
              onOpenEmail={handleOpenEmail}
              onOpenWebScraper={handleOpenWebScraper}
              onOpenMongoTest={handleOpenMongoTest}
              onOpenSupabase={handleOpenSupabase}
              onOpenProxyReverse={handleOpenProxyReverse}
              onOpenRansom={handleOpenRansom}
              onOpenC2={handleOpenC2}
              onOpenSettings={() => openWindow("settings")}
            />
            <WindowsPanel
              windows={visibleWindows}
              credentials={credentials}
              height={windowsHeight}
              focusedWindowId={focusedWindowId}
              activeSlot={activeSlot}
              packedDesktops={packedDesktops}
              draggingWindowId={dragState?.windowId ?? null}
              onCloseWindow={handleCloseWindow}
              onBlurWindow={handleBlurWindow}
              onCredentialsChanged={loadCredentials}
            />
          </Box>
          <WindowArt
            height={appHeight}
            width={artWidth}
            artCapture={artCapture}
            rightActiveSlot={rightActiveSlot}
            rightDesktops={rightDesktops}
            isCapturedFocused={focusedWindowId === ART_ID}
            isDragTarget={ghostOverPanel}
            credentials={credentials}
            onArtClose={handleArtClose}
            onArtBlur={handleBlurWindow}
            onCredentialsChanged={loadCredentials}
          />
        </Box>
      </Box>

      {}
      {dragState && (
        <DragGhost
          type={dragState.windowType}
          x={mouse.x}
          y={mouse.y}
          isOverTarget={ghostOverTarget}
          isOverSwap={ghostOverSwap}
        />
      )}
    </Box>
    </ServicesContext.Provider>
  );
};

