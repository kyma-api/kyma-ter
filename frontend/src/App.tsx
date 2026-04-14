import { useEffect } from "react";
import { TabBar } from "./components/Layout/TabBar";
import { Toolbar } from "./components/Layout/Toolbar";
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
      <Toolbar />
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
  const viewMode = useUIStore((s) => s.viewMode);

  useEffect(() => {
    fetchSessions();
    fetchTasks();
    fetchLocks();
    connectEvents();
  }, [fetchSessions, fetchTasks, fetchLocks, connectEvents]);

  return (
    <div className="app">
      <TabBar />
      <div className="main-content">
        {viewMode === "terminals" ? <TerminalView /> : <KanbanBoard />}
      </div>
      <StatusBar />
    </div>
  );
}
