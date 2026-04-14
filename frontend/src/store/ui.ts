import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAgentInfo } from "../types";
import {
  type LayoutNode,
  createLeaf,
  splitNode,
  removeNode,
  getLeafPaneIds,
  resetNodeCounter,
} from "../utils/layoutTree";

export interface Pane {
  id: string;
  sessionId: string;
  agentKey: string;
}

export interface Tab {
  id: string;
  name: string;
  customName: boolean;
  layout: LayoutNode | null; // tree layout, null = empty
  panes: Record<string, Pane>; // flat pane lookup by paneId
}

// Backwards compat: also expose panes as array for components that need it
export function getTabPanesArray(tab: Tab): Pane[] {
  if (!tab.layout) return [];
  const ids = getLeafPaneIds(tab.layout);
  return ids.map((id) => tab.panes[id]).filter(Boolean);
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
  focusedPaneId: string | null;

  addTab: (name?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  toggleTasksPanel: () => void;
  renameTab: (id: string, name: string) => void;
  setFocusedPane: (id: string | null) => void;
  nextTab: () => void;
  prevTab: () => void;

  addPane: (tabId: string, sessionId: string, agentKey: string) => void;
  removePane: (tabId: string, paneId: string) => void;
  splitPane: (tabId: string, paneId: string, direction: "horizontal" | "vertical", sessionId: string, agentKey: string) => void;

  restoreFromSessions: (runningSessions: Array<{ id: string; agent_key: string }>) => void;
  getAllSessionIds: () => string[];
}

let tabCounter = 0;
let paneCounter = 0;

function emptyTab(id: string, name?: string): Tab {
  return { id, name: name || "Workspace", customName: !!name, layout: null, panes: {} };
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      tabs: [emptyTab("tab-0")],
      activeTabId: "tab-0",
      tasksPanelOpen: false,
      focusedPaneId: null,

      addTab: (name?: string) => {
        tabCounter++;
        const id = `tab-${tabCounter}`;
        set((s) => ({ tabs: [...s.tabs, emptyTab(id, name)], activeTabId: id }));
        return id;
      },

      removeTab: (id: string) => {
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id);
          if (tabs.length === 0) {
            tabCounter++;
            const newId = `tab-${tabCounter}`;
            tabs.push(emptyTab(newId));
            return { tabs, activeTabId: newId };
          }
          const activeTabId = s.activeTabId === id ? tabs[0].id : s.activeTabId;
          return { tabs, activeTabId };
        });
      },

      setActiveTab: (id: string) => set({ activeTabId: id }),
      toggleTasksPanel: () => set((s) => ({ tasksPanelOpen: !s.tasksPanelOpen })),
      setFocusedPane: (id: string | null) => set({ focusedPaneId: id }),

      nextTab: () => {
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === s.activeTabId);
          const next = (idx + 1) % s.tabs.length;
          return { activeTabId: s.tabs[next].id };
        });
      },

      prevTab: () => {
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === s.activeTabId);
          const prev = (idx - 1 + s.tabs.length) % s.tabs.length;
          return { activeTabId: s.tabs[prev].id };
        });
      },

      renameTab: (id: string, name: string) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, name, customName: true } : t
          ),
        }));
      },

      addPane: (tabId: string, sessionId: string, agentKey: string) => {
        paneCounter++;
        const paneId = `pane-${paneCounter}`;
        const pane: Pane = { id: paneId, sessionId, agentKey };
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const newPanes = { ...t.panes, [paneId]: pane };
            let newLayout: LayoutNode;
            if (!t.layout) {
              // First pane: create leaf
              newLayout = createLeaf(paneId);
            } else if (t.layout.type === "leaf") {
              // Second pane: split horizontally
              newLayout = splitNode(t.layout, t.layout.id, "horizontal", paneId);
            } else {
              // 3+ panes: split the last leaf horizontally
              const leafIds = getLeafPaneIds(t.layout);
              const lastLeafPaneId = leafIds[leafIds.length - 1];
              // Find the node ID of the last leaf
              const lastNodeId = findLeafNodeId(t.layout, lastLeafPaneId);
              if (lastNodeId) {
                newLayout = splitNode(t.layout, lastNodeId, "horizontal", paneId);
              } else {
                newLayout = splitNode(t.layout, t.layout.id, "horizontal", paneId);
              }
            }
            const paneArr = Object.values(newPanes);
            return {
              ...t,
              layout: newLayout,
              panes: newPanes,
              name: t.customName ? t.name : deriveTabName(paneArr),
            };
          }),
        }));
      },

      removePane: (tabId: string, paneId: string) => {
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const nodeId = t.layout ? findLeafNodeId(t.layout, paneId) : null;
            const newLayout = t.layout && nodeId ? removeNode(t.layout, nodeId) : null;
            const { [paneId]: _removed, ...newPanes } = t.panes;
            const paneArr = Object.values(newPanes);
            return {
              ...t,
              layout: newLayout,
              panes: newPanes,
              name: t.customName ? t.name : deriveTabName(paneArr),
            };
          }),
        }));
      },

      splitPane: (tabId, paneId, direction, sessionId, agentKey) => {
        paneCounter++;
        const newPaneId = `pane-${paneCounter}`;
        const newPane: Pane = { id: newPaneId, sessionId, agentKey };
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId || !t.layout) return t;
            const nodeId = findLeafNodeId(t.layout, paneId);
            if (!nodeId) return t;
            const newLayout = splitNode(t.layout, nodeId, direction, newPaneId);
            const newPanes = { ...t.panes, [newPaneId]: newPane };
            const paneArr = Object.values(newPanes);
            return {
              ...t,
              layout: newLayout,
              panes: newPanes,
              name: t.customName ? t.name : deriveTabName(paneArr),
            };
          }),
        }));
      },

      restoreFromSessions: (runningSessions) => {
        const runningIds = new Set(runningSessions.map((s) => s.id));
        set((state) => {
          const tabs = state.tabs.map((t) => {
            // Filter out dead panes
            const validPanes: Record<string, Pane> = {};
            for (const [id, p] of Object.entries(t.panes)) {
              if (runningIds.has(p.sessionId)) validPanes[id] = p;
            }
            // Prune layout tree to only include valid panes
            let newLayout = t.layout;
            if (newLayout) {
              const deadPaneIds = Object.keys(t.panes).filter((id) => !validPanes[id]);
              for (const paneId of deadPaneIds) {
                if (!newLayout) break;
                const nodeId = findLeafNodeId(newLayout, paneId);
                if (nodeId) newLayout = removeNode(newLayout, nodeId);
              }
            }
            const paneArr = Object.values(validPanes);
            return {
              ...t,
              layout: newLayout,
              panes: validPanes,
              name: t.customName ? t.name : deriveTabName(paneArr),
            };
          });
          if (tabs.length === 0) {
            tabCounter++;
            tabs.push(emptyTab(`tab-${tabCounter}`));
          }
          const activeExists = tabs.some((t) => t.id === state.activeTabId);
          return { tabs, activeTabId: activeExists ? state.activeTabId : tabs[0].id };
        });

        // Restore counters
        const { tabs } = get();
        for (const t of tabs) {
          const num = parseInt(t.id.replace("tab-", ""), 10);
          if (num > tabCounter) tabCounter = num;
          for (const p of Object.values(t.panes)) {
            const pnum = parseInt(p.id.replace("pane-", ""), 10);
            if (pnum > paneCounter) paneCounter = pnum;
          }
        }
        // Also restore layout node counter
        for (const t of tabs) {
          if (t.layout) restoreNodeCounter(t.layout);
        }
      },

      getAllSessionIds: () => {
        const { tabs } = get();
        return tabs.flatMap((t) => Object.values(t.panes).map((p) => p.sessionId));
      },
    }),
    {
      name: "kyma-ter-ui",
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);

// Helper: find the layout node ID for a given paneId
function findLeafNodeId(node: LayoutNode, paneId: string): string | null {
  if (node.type === "leaf") {
    return node.paneId === paneId ? node.id : null;
  }
  for (const child of node.children ?? []) {
    const found = findLeafNodeId(child, paneId);
    if (found) return found;
  }
  return null;
}

// Restore node counter from persisted layout
function restoreNodeCounter(node: LayoutNode) {
  const num = parseInt(node.id.replace("node-", ""), 10);
  if (!isNaN(num)) resetNodeCounter(num);
  if (node.children) node.children.forEach(restoreNodeCounter);
}

// Derived selector
export function useActiveTab(): Tab | undefined {
  return useUIStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
}
