import { useState, useEffect } from "react";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore, useActiveTab } from "../../store/ui";
import { SetupModal } from "../Setup/SetupModal";
import { api } from "../../api/client";

export function Toolbar() {
  const [showSetup, setShowSetup] = useState(false);
  const [autoSpawned, setAutoSpawned] = useState(false);
  const createSession = useSessionsStore((s) => s.createSession);
  const { activeTabId, addPane } = useUIStore();
  const activeTab = useActiveTab();

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
    if (activeTab && Object.keys(activeTab.panes).length > 0) return;

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
      <div className="toolbar">
        <button className="toolbar-btn" onClick={() => {
          const sessionId = createSession("");
          sessionId.then((id) => addPane(activeTabId, id, ""));
        }}>
          + Terminal
        </button>
        <button className="toolbar-btn primary" onClick={handleAgentClick}>
          + Kyma Agent
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
