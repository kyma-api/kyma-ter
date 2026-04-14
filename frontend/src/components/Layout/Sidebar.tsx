import { useState, useEffect } from "react";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore, useActiveTab } from "../../store/ui";
import { useTasksStore } from "../../store/tasks";
import { SetupModal } from "../Setup/SetupModal";
import { api } from "../../api/client";

export function Sidebar() {
  const [showSetup, setShowSetup] = useState(false);
  const [autoSpawned, setAutoSpawned] = useState(false);
  const createSession = useSessionsStore((s) => s.createSession);
  const { activeTabId, addPane, tasksPanelOpen, toggleTasksPanel } = useUIStore();
  const activeTab = useActiveTab();
  const taskCount = useTasksStore((s) => s.tasks.length);

  const spawnKyma = async () => {
    const sessionId = await createSession("kyma");
    addPane(activeTabId, sessionId, "kyma");
  };

  const handleAgentClick = async () => {
    try {
      const status = await api.setupStatus();
      if (status.ready) {
        spawnKyma();
      } else {
        setShowSetup(true);
      }
    } catch {
      setShowSetup(true);
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    spawnKyma();
  };

  // Auto-spawn Kyma Agent on first load if ready and no panes open
  useEffect(() => {
    if (autoSpawned) return;
    if (activeTab && activeTab.panes.length > 0) return;

    const tryAutoSpawn = async () => {
      try {
        const status = await api.setupStatus();
        if (status.ready) {
          setAutoSpawned(true);
          spawnKyma();
        }
      } catch {
        // Not ready, user will click manually
      }
    };

    const timer = setTimeout(tryAutoSpawn, 300);
    return () => clearTimeout(timer);
  }, [activeTab?.id]);

  return (
    <>
      <div className="sidebar">
        <button
          className="sidebar-btn sidebar-btn-primary"
          onClick={handleAgentClick}
          title="New Kyma Agent"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a3 3 0 0 0-3 3v1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3zm0 1.5A1.5 1.5 0 0 1 9.5 4v1h-3V4A1.5 1.5 0 0 1 8 2.5zM6 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
          </svg>
          <span className="sidebar-label">Agent</span>
        </button>
        <button
          className={`sidebar-btn ${tasksPanelOpen ? "sidebar-btn-active" : ""}`}
          onClick={toggleTasksPanel}
          title="Toggle Tasks"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-9zM5 5h6v1.5H5V5zm0 3h6v1.5H5V8zm0 3h4v1.5H5V11z" />
          </svg>
          <span className="sidebar-label">Tasks</span>
          {taskCount > 0 && (
            <span className="sidebar-badge">{taskCount}</span>
          )}
        </button>
      </div>
      {showSetup && (
        <SetupModal
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}
