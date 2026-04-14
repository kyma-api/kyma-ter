import { useState, useRef, useEffect } from "react";
import { useUIStore, getTabPanesArray } from "../../store/ui";
import { getAgentInfo } from "../../types";
import { PlusDropdown } from "./PlusDropdown";
import { SetupModal } from "../Setup/SetupModal";
import { spawnShell, spawnKymaIfReady, spawnAgent } from "../../utils/spawn";

function EditableTabName({ tabId, name }: { tabId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameTab = useUIStore((s) => s.renameTab);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      renameTab(tabId, trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="tab-name-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(name); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="tab-name"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(name);
        setEditing(true);
      }}
    >
      {name}
    </span>
  );
}

interface TabBarProps {
  plusDropdownOpen: boolean;
  setPlusDropdownOpen: (open: boolean) => void;
}

export function TabBar({ plusDropdownOpen, setPlusDropdownOpen }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab } = useUIStore();
  const [showSetup, setShowSetup] = useState(false);

  const handleNewTerminal = () => {
    const tabId = addTab();
    spawnShell(tabId);
  };

  const handleNewAgent = () => {
    const tabId = addTab();
    spawnKymaIfReady(tabId, () => setShowSetup(true));
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    const ui = useUIStore.getState();
    spawnAgent("kyma", ui.activeTabId);
  };

  return (
    <>
      <div className="tab-bar">
        <div className="tab-bar-left">
          <div className="logo">kyma-ter</div>
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${tab.id === activeTabId ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <EditableTabName tabId={tab.id} name={tab.name} />
                {(() => {
                  const panesArr = getTabPanesArray(tab);
                  return panesArr.length > 0 ? (
                    <span className="tab-badges">
                      {panesArr.slice(0, 3).map((p) => {
                        const a = getAgentInfo(p.agentKey);
                        return (
                          <span
                            key={p.id}
                            className="tab-badge-dot"
                            style={{ backgroundColor: a.color }}
                            title={a.name}
                          />
                        );
                      })}
                    </span>
                  ) : null;
                })()}
                {tabs.length > 1 && (
                  <span
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                  >
                    &times;
                  </span>
                )}
              </button>
            ))}
            <div className="tab-add-wrapper">
              <button
                className="tab tab-add"
                onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
                title="New tab (Alt+T)"
              >
                +
              </button>
              <PlusDropdown
                open={plusDropdownOpen}
                onClose={() => setPlusDropdownOpen(false)}
                onNewTerminal={handleNewTerminal}
                onNewAgent={handleNewAgent}
              />
            </div>
          </div>
        </div>
        <div className="tab-bar-right" />
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
