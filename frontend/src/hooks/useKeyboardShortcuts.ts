import { useEffect } from "react";
import { useUIStore, getTabPanesArray } from "../store/ui";
import { useSessionsStore } from "../store/sessions";
import { useSettingsStore, bindingMatches } from "../store/settings";
import { spawnAgent } from "../utils/spawn";

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
          case "newKymaAgent": {
            spawnAgent("kyma", ui.activeTabId);
            break;
          }

          case "closePane": {
            // If settings overlay is open, close it instead
            if (ui.settingsOpen) {
              ui.setSettingsOpen(false);
              break;
            }
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

          case "newWorkspace": {
            ui.addTab();
            break;
          }

          case "agentWorkspace": {
            ui.setAgentWorkspaceOpen(true);
            break;
          }

          case "settings": {
            ui.setSettingsOpen(!ui.settingsOpen);
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
