import { create } from "zustand";
import { getAgentInfo } from "../types";

export interface Pane {
  id: string;
  sessionId: string;
  agentKey: string;
}

export interface Tab {
  id: string;
  name: string;
  customName: boolean; // true if user manually renamed
  panes: Pane[];
}

function deriveTabName(panes: Pane[]): string {
  if (panes.length === 0) return "Workspace";
  const first = getAgentInfo(panes[0].agentKey);
  if (panes.length === 1) return first.name || "Shell";
  return `${first.name || "Shell"} +${panes.length - 1}`;
}

interface UIState {
  tabs: Tab[];
  activeTabId: string;
  tasksPanelOpen: boolean;

  addTab: (name?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  toggleTasksPanel: () => void;
  renameTab: (id: string, name: string) => void;

  addPane: (tabId: string, sessionId: string, agentKey: string) => void;
  removePane: (tabId: string, paneId: string) => void;
}

let tabCounter = 0;
let paneCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  tabs: [{ id: "tab-0", name: "Workspace", customName: false, panes: [] }],
  activeTabId: "tab-0",
  tasksPanelOpen: false,

  addTab: (name?: string) => {
    tabCounter++;
    const id = `tab-${tabCounter}`;
    const tab: Tab = {
      id,
      name: name || "Workspace",
      customName: !!name,
      panes: [],
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  removeTab: (id: string) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (tabs.length === 0) {
        tabCounter++;
        const newId = `tab-${tabCounter}`;
        tabs.push({ id: newId, name: "Workspace", customName: false, panes: [] });
        return { tabs, activeTabId: newId };
      }
      const activeTabId = s.activeTabId === id ? tabs[0].id : s.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),
  toggleTasksPanel: () => set((s) => ({ tasksPanelOpen: !s.tasksPanelOpen })),

  renameTab: (id: string, name: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, name, customName: true } : t
      ),
    }));
  },

  addPane: (tabId: string, sessionId: string, agentKey: string) => {
    paneCounter++;
    const pane: Pane = { id: `pane-${paneCounter}`, sessionId, agentKey };
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newPanes = [...t.panes, pane];
        return {
          ...t,
          panes: newPanes,
          name: t.customName ? t.name : deriveTabName(newPanes),
        };
      }),
    }));
  },

  removePane: (tabId: string, paneId: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t;
        const newPanes = t.panes.filter((p) => p.id !== paneId);
        return {
          ...t,
          panes: newPanes,
          name: t.customName ? t.name : deriveTabName(newPanes),
        };
      }),
    }));
  },
}));

// Derived selector
export function useActiveTab(): Tab | undefined {
  return useUIStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
}
