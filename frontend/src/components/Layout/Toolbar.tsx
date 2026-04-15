import { useEffect, useState } from "react";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore, useActiveTab } from "../../store/ui";

export function Toolbar() {
  const [autoSpawned, setAutoSpawned] = useState(false);
  const createSession = useSessionsStore((s) => s.createSession);
  const { activeTabId, addPane } = useUIStore();
  const activeTab = useActiveTab();

  const spawnKyma = async () => {
    const sessionId = await createSession("kyma");
    addPane(activeTabId, sessionId, "kyma");
  };

  // Auto-spawn Kyma Agent on first load if no panes open
  useEffect(() => {
    if (autoSpawned) return;
    if (activeTab && Object.keys(activeTab.panes).length > 0) return;

    setAutoSpawned(true);
    const timer = setTimeout(spawnKyma, 300);
    return () => clearTimeout(timer);
  }, [activeTab?.id]);

  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={() => {
        const sessionId = createSession("");
        sessionId.then((id) => addPane(activeTabId, id, ""));
      }}>
        + Terminal
      </button>
      <button className="toolbar-btn primary" onClick={spawnKyma}>
        + Kyma Agent
      </button>
    </div>
  );
}
