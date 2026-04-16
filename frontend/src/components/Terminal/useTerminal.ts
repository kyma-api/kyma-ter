import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { createTerminalWS } from "../../api/ws";
import { api } from "../../api/client";

interface UseTerminalOptions {
  sessionId: string;
  onExit?: (exitCode: number) => void;
}

export function useTerminal({ sessionId, onExit }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const disposed = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processExited = useRef(false);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !sessionId) return;
    disposed.current = false;
    processExited.current = false;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#a1a1aa",
        selectionBackground: "#27272a",
        black: "#09090b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    // Try WebGL, fall back to canvas
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not supported, using canvas renderer
    }

    fitAddon.fit();

    // Clipboard support: Ctrl+C (copy) and Ctrl+V (paste)
    term.attachCustomKeyEventHandler((ev) => {
      // Only handle keydown events
      if (ev.type !== "keydown") return true;

      const isCtrlOrCmd = ev.ctrlKey || ev.metaKey;

      // Ctrl+V / Cmd+V: Paste from clipboard (text or image)
      // We handle this manually and block xterm's default paste
      if (isCtrlOrCmd && !ev.shiftKey && ev.key === "v") {
        ev.preventDefault();
        ev.stopPropagation();

        // Try to read clipboard items (supports images)
        navigator.clipboard.read().then(async (items) => {
          for (const item of items) {
            // Check for image types first
            const imageType = item.types.find(t => t.startsWith("image/"));
            if (imageType) {
              try {
                const blob = await item.getType(imageType);
                const ext = imageType.split("/")[1] || "png";
                const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imageType });
                const serverPath = await api.uploadFile(file);
                const escaped = serverPath.includes(" ") ? `'${serverPath}'` : serverPath;
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  const encoder = new TextEncoder();
                  wsRef.current.send(encoder.encode(escaped + " "));
                }
              } catch {
                // Image upload failed, ignore
              }
              return;
            }

            // Fall back to text
            if (item.types.includes("text/plain")) {
              const blob = await item.getType("text/plain");
              const text = await blob.text();
              if (text && wsRef.current?.readyState === WebSocket.OPEN) {
                const encoder = new TextEncoder();
                wsRef.current.send(encoder.encode(text));
              }
              return;
            }
          }
        }).catch(() => {
          // Clipboard API not supported or denied, fall back to readText
          navigator.clipboard.readText().then((text) => {
            if (text && wsRef.current?.readyState === WebSocket.OPEN) {
              const encoder = new TextEncoder();
              wsRef.current.send(encoder.encode(text));
            }
          }).catch(() => {});
        });
        return false; // Block xterm from also handling this
      }

      // Ctrl+C / Cmd+C: Copy selection to clipboard (if text is selected)
      if (isCtrlOrCmd && !ev.shiftKey && ev.key === "c") {
        const selection = term.getSelection();
        if (selection) {
          ev.preventDefault();
          navigator.clipboard.writeText(selection).catch(() => {});
          return false; // Prevent default (don't send SIGINT)
        }
        // No selection: let Ctrl+C pass through as SIGINT
        return true;
      }

      // Ctrl+Shift+C: Always copy
      if (isCtrlOrCmd && ev.shiftKey && ev.key === "C") {
        ev.preventDefault();
        const selection = term.getSelection() || "";
        navigator.clipboard.writeText(selection).catch(() => {});
        return false;
      }

      // Ctrl+Shift+V: Alternative paste
      if (isCtrlOrCmd && ev.shiftKey && ev.key === "V") {
        ev.preventDefault();
        ev.stopPropagation();
        navigator.clipboard.readText().then((text) => {
          if (text && wsRef.current?.readyState === WebSocket.OPEN) {
            const encoder = new TextEncoder();
            wsRef.current.send(encoder.encode(text));
          }
        }).catch(() => {});
        return false;
      }

      return true; // Let other keys pass through
    });

    // WebSocket connection with reconnect
    let retryDelay = 1000;
    const MAX_RETRY = 30_000;

    function connectWS() {
      if (disposed.current || processExited.current) return;

      const ws = createTerminalWS(sessionId);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        retryDelay = 1000; // reset backoff on success
        // Send initial resize
        const msg = JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows });
        ws.send(msg);
      };

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(ev.data));
        } else if (typeof ev.data === "string") {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "exited") {
              processExited.current = true;
              term.write(`\r\n\x1b[90m[Process exited with code ${msg.exit_code}]\x1b[0m\r\n`);
              onExit?.(msg.exit_code);
            }
          } catch {
            // Not JSON, ignore
          }
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (disposed.current || processExited.current) {
          if (!processExited.current) {
            term.write("\r\n\x1b[90m[Disconnected]\x1b[0m\r\n");
          }
          return;
        }
        // Auto-reconnect with exponential backoff
        term.write("\r\n\x1b[33m[Reconnecting...]\x1b[0m\r\n");
        reconnectTimer.current = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
          connectWS();
        }, retryDelay);
      };

      wsRef.current = ws;

      // Terminal input → WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const encoder = new TextEncoder();
          ws.send(encoder.encode(data));
        }
      });

      // Resize handler
      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    }

    connectWS();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Observe container resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    observer.observe(containerRef.current);

    // Native drag-and-drop handlers (must be native because xterm captures React events)
    const container = containerRef.current;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Upload each file to server, get full server-side path
      for (const file of Array.from(files)) {
        try {
          const serverPath = await api.uploadFile(file);
          const escaped = serverPath.includes(" ") ? `'${serverPath}'` : serverPath;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            const encoder = new TextEncoder();
            ws.send(encoder.encode(escaped + " "));
          }
        } catch {
          // Ignore upload errors
        }
      }
    };

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);

    return () => {
      disposed.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
      observer.disconnect();
      wsRef.current?.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, onExit]);

  // Write text to PTY (e.g., pasting a file path)
  const writeText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoder = new TextEncoder();
      ws.send(encoder.encode(text));
    }
  }, []);

  return { containerRef, termRef, fit, writeText };
}
