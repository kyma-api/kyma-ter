import { useState } from "react";
import { useUIStore } from "../../store/ui";
import { SetupModal } from "../Setup/SetupModal";
import { spawnShell, spawnKymaIfReady, spawnAgent } from "../../utils/spawn";

export function Sidebar() {
  const [showSetup, setShowSetup] = useState(false);
  const { activeTabId } = useUIStore();

  const handleAgentClick = () => {
    spawnKymaIfReady(activeTabId, () => setShowSetup(true));
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    spawnAgent("kyma", activeTabId);
  };

  return (
    <>
      <div className="sidebar">
        <button
          className="sidebar-btn"
          onClick={() => spawnShell(activeTabId)}
          title="New Terminal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="sidebar-label">Terminal</span>
        </button>
        <button
          className="sidebar-btn"
          onClick={handleAgentClick}
          title="New Kyma Agent"
        >
          <svg width="16" height="15" viewBox="0 0 48 46" fill="none">
            <path fill="#eab308" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
          </svg>
          <span className="sidebar-label">Agent</span>
        </button>
        <div className="sidebar-spacer" />
        <button
          className="sidebar-btn"
          onClick={() => useUIStore.getState().setSettingsOpen(true)}
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="sidebar-label">Settings</span>
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
