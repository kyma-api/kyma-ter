import { useEffect, useRef } from "react";
import { TabBar } from "./components/Layout/TabBar";
import { Sidebar } from "./components/Layout/Sidebar";
import { PaneGrid } from "./components/Layout/PaneGrid";
import { StatusBar } from "./components/Layout/StatusBar";
import { AgentWorkspaceModal } from "./components/AgentWorkspace/AgentWorkspaceModal";
import { SettingsOverlay } from "./components/Settings/SettingsOverlay";
import { spawnShell, spawnAgent } from "./utils/spawn";
import { useSessionsStore } from "./store/sessions";
import { useTasksStore } from "./store/tasks";
import { useLocksStore } from "./store/locks";
import { useEventsStore } from "./store/events";
import { useUIStore, useActiveTab } from "./store/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function TerminalView() {
  const activeTab = useActiveTab();
  const { removePane, movePane, focusedPaneId, setFocusedPane, activeTabId } = useUIStore();
  const deleteSession = useSessionsStore((s) => s.deleteSession);

  const handleClosePane = async (paneId: string) => {
    if (!activeTab) return;
    const pane = activeTab.panes[paneId];
    if (pane) {
      try {
        await deleteSession(pane.sessionId);
      } catch {
        // Session may already be gone
      }
    }
    removePane(activeTab.id, paneId);
  };

  if (!activeTab) return null;

  return (
    <div className="terminal-view">
      <div className="pane-area">
        <PaneGrid
          tab={activeTab}
          focusedPaneId={focusedPaneId}
          onClosePane={handleClosePane}
          onMovePane={(source, target, zone) => movePane(activeTab.id, source, target, zone)}
          onFocusPane={setFocusedPane}
          onNewTerminal={() => spawnShell(activeTabId)}
          onNewAgent={() => spawnAgent("kyma", activeTabId)}
        />
      </div>
    </div>
  );
}

export default function App() {
  const fetchSessions = useSessionsStore((s) => s.fetch);
  const fetchTasks = useTasksStore((s) => s.fetch);
  const fetchLocks = useLocksStore((s) => s.fetch);
  const connectEvents = useEventsStore((s) => s.connect);
  const restored = useRef(false);

  useKeyboardShortcuts();

  // Initialize: fetch data, connect events, restore persisted layout
  useEffect(() => {
    fetchTasks();
    fetchLocks();
    connectEvents();

    // Restore persisted tab layout against live sessions
    if (!restored.current) {
      restored.current = true;
      fetchSessions().then(() => {
        const sessions = useSessionsStore.getState().sessions;
        const running = sessions
          .filter((s) => !s.exited)
          .map((s) => ({ id: s.id, agent_key: s.agent_key }));
        useUIStore.getState().restoreFromSessions(running);
      });
    }
  }, [fetchSessions, fetchTasks, fetchLocks, connectEvents]);

  // beforeunload: notify server this client is leaving
  useEffect(() => {
    const handleUnload = () => {
      // Note: we do NOT kill sessions on unload — heartbeat handles cleanup.
      // This just signals the server that this client disconnected.
      // Sessions will be reclaimed if browser reopens within grace period.
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Prevent browser from opening dropped files in a new tab
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const agentWorkspaceOpen = useUIStore((s) => s.agentWorkspaceOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const activeTabId = useUIStore((s) => s.activeTabId);

  return (
    <div className="app">
      <TabBar />
      <div className="app-body">
        <Sidebar />
        <div className="main-content">
          <TerminalView />
        </div>
      </div>
      <StatusBar />
      {agentWorkspaceOpen && (
        <AgentWorkspaceModal
          tabId={activeTabId}
          onClose={() => useUIStore.getState().setAgentWorkspaceOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsOverlay
          onClose={() => useUIStore.getState().setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
