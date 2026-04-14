import { create } from "zustand";

export type ViewMode = "terminals" | "kanban";

export interface Pane {
  id: string;
  sessionId: string;
  agentKey: string;
}

export interface Tab {
  id: string;
  name: string;
  panes: Pane[];
}

interface UIState {
  tabs: Tab[];
  activeTabId: string;
  viewMode: ViewMode;

  addTab: (name?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;

  addPane: (tabId: string, sessionId: string, agentKey: string) => void;
  removePane: (tabId: string, paneId: string) => void;
}

let tabCounter = 0;
let paneCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  tabs: [{ id: "tab-0", name: "Terminal", panes: [] }],
  activeTabId: "tab-0",
  viewMode: "terminals",

  addTab: (name?: string) => {
    tabCounter++;
    const id = `tab-${tabCounter}`;
    const tab: Tab = { id, name: name || `Tab ${tabCounter + 1}`, panes: [] };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  removeTab: (id: string) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (tabs.length === 0) {
        tabCounter++;
        const newId = `tab-${tabCounter}`;
        tabs.push({ id: newId, name: "Terminal", panes: [] });
        return { tabs, activeTabId: newId };
      }
      const activeTabId = s.activeTabId === id ? tabs[0].id : s.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id: string) => set({ activeTabId: id }),
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

  addPane: (tabId: string, sessionId: string, agentKey: string) => {
    paneCounter++;
    const pane: Pane = { id: `pane-${paneCounter}`, sessionId, agentKey };
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, panes: [...t.panes, pane] } : t
      ),
    }));
  },

  removePane: (tabId: string, paneId: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, panes: t.panes.filter((p) => p.id !== paneId) }
          : t
      ),
    }));
  },
}));

// Derived selector
export function useActiveTab(): Tab | undefined {
  return useUIStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
}
