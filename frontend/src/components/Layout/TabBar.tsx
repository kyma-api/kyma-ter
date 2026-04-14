import { useState, useRef, useEffect } from "react";
import { useUIStore, getTabPanesArray } from "../../store/ui";
import { useSessionsStore } from "../../store/sessions";
import { getAgentInfo } from "../../types";

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

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, addTab, removeTab } = useUIStore();

  return (
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
                    // Kill all sessions in this tab before removing it
                    const panes = getTabPanesArray(tab);
                    const delSession = useSessionsStore.getState().deleteSession;
                    for (const p of panes) {
                      delSession(p.sessionId).catch(() => {});
                    }
                    removeTab(tab.id);
                  }}
                >
                  &times;
                </span>
              )}
            </button>
          ))}
          <button className="tab tab-add" onClick={() => addTab()} title="New workspace">
            +
          </button>
        </div>
      </div>
      <div className="tab-bar-right" />
    </div>
  );
}
