import { useEffect } from "react";
import { useUIStore, getTabPanesArray } from "../store/ui";
import { useSessionsStore } from "../store/sessions";

interface ShortcutCallbacks {
  onTogglePlusDropdown?: () => void;
}

export function useKeyboardShortcuts(callbacks?: ShortcutCallbacks) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle Alt+key combos (capture phase intercepts before xterm)
      if (!e.altKey) return;

      const ui = useUIStore.getState();

      switch (e.key) {
        case "t": {
          // Alt+T: Toggle "+" dropdown
          e.preventDefault();
          e.stopPropagation();
          callbacks?.onTogglePlusDropdown?.();
          break;
        }

        case "w": {
          // Alt+W: Close focused pane
          e.preventDefault();
          e.stopPropagation();
          const activeTab = ui.tabs.find((t) => t.id === ui.activeTabId);
          if (!activeTab) break;
          const panesArr = getTabPanesArray(activeTab);
          if (panesArr.length === 0) break;
          const paneToClose = panesArr.find((p) => p.id === ui.focusedPaneId)
            || panesArr[panesArr.length - 1];
          if (paneToClose) {
            useSessionsStore.getState().deleteSession(paneToClose.sessionId).catch(() => {});
            ui.removePane(activeTab.id, paneToClose.id);
          }
          break;
        }

        case "[": {
          e.preventDefault();
          e.stopPropagation();
          ui.prevTab();
          break;
        }

        case "]": {
          e.preventDefault();
          e.stopPropagation();
          ui.nextTab();
          break;
        }

        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          e.stopPropagation();
          const activeTab = ui.tabs.find((t) => t.id === ui.activeTabId);
          if (!activeTab) break;
          const panesArr = getTabPanesArray(activeTab);
          if (panesArr.length <= 1) break;
          const currentIdx = panesArr.findIndex((p) => p.id === ui.focusedPaneId);
          let nextIdx: number;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            nextIdx = (currentIdx + 1) % panesArr.length;
          } else {
            nextIdx = (currentIdx - 1 + panesArr.length) % panesArr.length;
          }
          ui.setFocusedPane(panesArr[nextIdx].id);
          break;
        }
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [callbacks]);
}
