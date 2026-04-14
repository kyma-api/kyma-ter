import { useEffect } from "react";
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

function TerminalView() {
  const activeTab = useActiveTab();
  const { removePane } = useUIStore();
  const deleteSession = useSessionsStore((s) => s.deleteSession);

  const handleClosePane = async (paneId: string) => {
    if (!activeTab) return;
    const pane = activeTab.panes.find((p) => p.id === paneId);
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
        <PaneGrid panes={activeTab.panes} onClosePane={handleClosePane} />
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

  useEffect(() => {
    fetchSessions();
    fetchTasks();
    fetchLocks();
    connectEvents();
  }, [fetchSessions, fetchTasks, fetchLocks, connectEvents]);

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
      <TabBar />
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
