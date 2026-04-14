import { useUIStore } from "../../store/ui";
import { getAgentInfo } from "../../types";

export function TabBar() {
  const { tabs, activeTabId, viewMode, setActiveTab, addTab, removeTab, setViewMode } = useUIStore();

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
              <span className="tab-name">{tab.name}</span>
              {tab.panes.length > 0 && (
                <span className="tab-badges">
                  {tab.panes.slice(0, 3).map((p) => {
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
              )}
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
          <button className="tab tab-add" onClick={() => addTab()} title="New tab">
            +
          </button>
        </div>
      </div>
      <div className="tab-bar-right">
        <div className="view-toggle">
          <button
            className={viewMode === "terminals" ? "active" : ""}
            onClick={() => setViewMode("terminals")}
          >
            Terminals
          </button>
          <button
            className={viewMode === "kanban" ? "active" : ""}
            onClick={() => setViewMode("kanban")}
          >
            Tasks
          </button>
        </div>
      </div>
    </div>
  );
}
