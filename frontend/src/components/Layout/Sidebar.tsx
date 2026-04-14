import { useState, useEffect } from "react";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore, useActiveTab } from "../../store/ui";
import { SetupModal } from "../Setup/SetupModal";
import { api } from "../../api/client";

export function Sidebar() {
  const [showSetup, setShowSetup] = useState(false);
  const [autoSpawned, setAutoSpawned] = useState(false);
  const createSession = useSessionsStore((s) => s.createSession);
  const { activeTabId, addPane } = useUIStore();
  const activeTab = useActiveTab();

  const spawnTerminal = async () => {
    const sessionId = await createSession("");
    addPane(activeTabId, sessionId, "");
  };

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
          className="sidebar-btn"
          onClick={spawnTerminal}
          title="New Terminal"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3l5 4-5 4V3zm6 6h6v2H8V9z" />
          </svg>
          <span className="sidebar-label">Terminal</span>
        </button>
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
