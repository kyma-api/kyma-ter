import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ShortcutBinding {
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface ShortcutAction {
  id: string;
  label: string;
  binding: ShortcutBinding;
}

const DEFAULT_SHORTCUTS: ShortcutAction[] = [
  { id: "newKymaAgent", label: "New Kyma Agent", binding: { key: "k", metaKey: false, shiftKey: false, ctrlKey: true } },
  { id: "newTerminal", label: "New Terminal", binding: { key: "n", metaKey: false, shiftKey: false, ctrlKey: true } },
  { id: "closePane", label: "Close Pane", binding: { key: "w", metaKey: false, shiftKey: false, ctrlKey: true } },
  { id: "newWorkspace", label: "New Workspace", binding: { key: "t", metaKey: false, shiftKey: false, ctrlKey: true } },
  { id: "agentWorkspace", label: "Agent Workspace", binding: { key: "a", metaKey: false, shiftKey: false, ctrlKey: true } },
  { id: "settings", label: "Settings", binding: { key: ",", metaKey: false, shiftKey: false, ctrlKey: true } },
];

interface SettingsState {
  shortcuts: ShortcutAction[];
  updateShortcut: (actionId: string, binding: ShortcutBinding) => void;
  resetDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shortcuts: DEFAULT_SHORTCUTS,

      updateShortcut: (actionId, binding) => {
        set((s) => ({
          shortcuts: s.shortcuts.map((sc) =>
            sc.id === actionId ? { ...sc, binding } : sc
          ),
        }));
      },

      resetDefaults: () => {
        set({ shortcuts: DEFAULT_SHORTCUTS });
      },
    }),
    {
      name: "kyma-ter-settings",
      version: 4,
      partialize: (state) => ({ shortcuts: state.shortcuts }),
      migrate: () => {
        // Reset to defaults on version bump
        return { shortcuts: DEFAULT_SHORTCUTS };
      },
    }
  )
);

export function formatBinding(b: ShortcutBinding): string {
  const parts: string[] = [];
  if (b.ctrlKey) parts.push("Ctrl");
  if (b.metaKey) parts.push("Cmd");
  if (b.shiftKey) parts.push("Shift");
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join(" + ");
}

export function bindingMatches(e: KeyboardEvent, b: ShortcutBinding): boolean {
  return (
    e.metaKey === b.metaKey &&
    e.shiftKey === b.shiftKey &&
    e.ctrlKey === b.ctrlKey &&
    e.key.toLowerCase() === b.key.toLowerCase()
  );
}
