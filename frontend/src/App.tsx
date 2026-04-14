import { useEffect, useRef, useState, useCallback } from "react";
import { TabBar } from "./components/Layout/TabBar";
import { Sidebar } from "./components/Layout/Sidebar";
import { PaneGrid } from "./components/Layout/PaneGrid";
import { StatusBar } from "./components/Layout/StatusBar";
import { KanbanBoard } from "./components/Kanban/KanbanBoard";
import { useSessionsStore } from "./store/sessions";
import { useTasksStore } from "./store/tasks";
import { useLocksStore } from "./store/locks";
import { useEventsStore } from "./store/events";
import { useUIStore, useActiveTab } from "./store/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function TerminalView() {
  const activeTab = useActiveTab();
  const { removePane, splitPane } = useUIStore();
  const createSession = useSessionsStore((s) => s.createSession);
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

  const handleSplitPane = async (paneId: string, direction: "horizontal" | "vertical") => {
    if (!activeTab) return;
    const pane = activeTab.panes[paneId];
    if (!pane) return;
    // Spawn a new session with the same agent type
    const sessionId = await createSession(pane.agentKey);
    splitPane(activeTab.id, paneId, direction, sessionId, pane.agentKey);
  };

  if (!activeTab) return null;

  return (
    <div className="terminal-view">
      <div className="pane-area">
        <PaneGrid
          tab={activeTab}
          onClosePane={handleClosePane}
          onSplitPane={handleSplitPane}
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
  const tasksPanelOpen = useUIStore((s) => s.tasksPanelOpen);
  const restored = useRef(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);

  const togglePlusDropdown = useCallback(() => {
    setPlusDropdownOpen((v) => !v);
  }, []);

  useKeyboardShortcuts({ onTogglePlusDropdown: togglePlusDropdown });

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

  return (
    <div className="app">
      <TabBar
        plusDropdownOpen={plusDropdownOpen}
        setPlusDropdownOpen={setPlusDropdownOpen}
      />
      <div className="app-body">
        <div className="main-content">
          <TerminalView />
        </div>
        {tasksPanelOpen && (
          <div className="tasks-panel">
            <div className="tasks-panel-header">
              <span className="tasks-panel-title">Tasks</span>
              <button
                className="close-btn"
                onClick={() => useUIStore.getState().toggleTasksPanel()}
              >
                &times;
              </button>
            </div>
            <div className="tasks-panel-body">
              <KanbanBoard />
            </div>
          </div>
        )}
        <Sidebar />
      </div>
      <StatusBar />
    </div>
  );
}
