import { useEffect } from "react";
import { useUIStore, getTabPanesArray } from "../store/ui";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore, bindingMatches } from "../store/settings";
import { spawnShell, spawnKymaIfReady } from "../utils/spawn";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle shortcuts with a modifier key
      if (!e.metaKey && !e.ctrlKey) return;
      // Ignore if typing in a real input (not xterm's hidden textarea)
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLTextAreaElement && !target.closest(".xterm")) return;

      const shortcuts = useSettingsStore.getState().shortcuts;
      const ui = useUIStore.getState();

      for (const sc of shortcuts) {
        if (!bindingMatches(e, sc.binding)) continue;

        e.preventDefault();
        e.stopPropagation();

        switch (sc.id) {
          case "newTerminal": {
            spawnShell(ui.activeTabId);
            break;
          }

          case "newKymaAgent": {
            spawnKymaIfReady(ui.activeTabId, () => {
              ui.setAgentWorkspaceOpen(true);
            });
            break;
          }

          case "closePane": {
            const activeTab = ui.tabs.find((t) => t.id === ui.activeTabId);
            if (!activeTab) break;
            // Close settings tab directly
            if (activeTab.type === "settings") {
              ui.removeTab(activeTab.id);
              ui.setSettingsOpen(false);
              break;
            }
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

          case "newWorkspace": {
            ui.addTab();
            break;
          }

          case "agentWorkspace": {
            ui.setAgentWorkspaceOpen(true);
            break;
          }

          case "settings": {
            ui.setSettingsOpen(true);
            break;
          }
        }

        return; // Handled
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);
}
