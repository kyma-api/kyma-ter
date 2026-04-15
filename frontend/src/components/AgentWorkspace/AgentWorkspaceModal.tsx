import { useState } from "react";
import { DEFAULT_AGENTS, getAgentInfo } from "../../types";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore } from "../../store/ui";

interface LayoutPreset {
  id: string;
  label: string;
  count: number;
  cols: number;
  rows: number;
}

const PRESETS: LayoutPreset[] = [
  { id: "duo", label: "Duo", count: 2, cols: 2, rows: 1 },
  { id: "quad", label: "Quad", count: 4, cols: 2, rows: 2 },
  { id: "sixpack", label: "Six Pack", count: 6, cols: 3, rows: 2 },
  { id: "octet", label: "Octet", count: 8, cols: 4, rows: 2 },
  { id: "dozen", label: "Dozen", count: 12, cols: 4, rows: 3 },
  { id: "fleet", label: "Fleet", count: 16, cols: 4, rows: 4 },
];

const AGENT_OPTIONS = [
  ...Object.entries(DEFAULT_AGENTS).map(([key, cfg]) => ({ key, label: cfg.name, color: cfg.color })),
  { key: "shell", label: "Shell", color: "#6b7280" },
];

interface Props {
  tabId: string;
  onClose: () => void;
}

export function AgentWorkspaceModal({ tabId, onClose }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<LayoutPreset>(PRESETS[1]); // Quad default
  const [agents, setAgents] = useState<string[]>(() => Array(PRESETS[1].count).fill("kyma"));
  const [launching, setLaunching] = useState(false);

  const handlePresetChange = (preset: LayoutPreset) => {
    setSelectedPreset(preset);
    setAgents((prev) => {
      const next = Array(preset.count).fill("kyma");
      // Preserve existing selections where possible
      for (let i = 0; i < Math.min(prev.length, next.length); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  };

  const handleAgentChange = (index: number, agentKey: string) => {
    setAgents((prev) => {
      const next = [...prev];
      next[index] = agentKey;
      return next;
    });
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      // Create all sessions
      const createSession = useSessionsStore.getState().createSession;
      const panes: Array<{ sessionId: string; agentKey: string }> = [];
      for (const agentKey of agents) {
        const sessionId = await createSession(agentKey);
        panes.push({ sessionId, agentKey });
      }

      // Use current tab if empty, otherwise create a new one
      const ui = useUIStore.getState();
      const currentTab = ui.tabs.find((t) => t.id === tabId);
      const targetTabId = currentTab && Object.keys(currentTab.panes).length > 0
        ? ui.addTab()
        : tabId;

      // Launch workspace with grid layout
      ui.launchWorkspace(targetTabId, panes, selectedPreset.cols, selectedPreset.rows);
      onClose();
    } catch (err) {
      console.error("Failed to launch workspace:", err);
      setLaunching(false);
    }
  };

  return (
    <div className="setup-overlay" onClick={onClose}>
      <div className="workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-header">
          <h2>Agent Workspace</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="workspace-body">
          <div className="workspace-section-label">LAYOUT</div>
          <div className="layout-grid">
            {PRESETS.map((preset) => (
              <div
                key={preset.id}
                className={`layout-card ${selectedPreset.id === preset.id ? "selected" : ""}`}
                onClick={() => handlePresetChange(preset)}
              >
                <div className="layout-preview" style={{
                  gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${preset.rows}, 1fr)`,
                }}>
                  {Array.from({ length: preset.count }).map((_, i) => (
                    <div key={i} className="layout-dot" />
                  ))}
                </div>
                <div className="layout-label">
                  {preset.label}
                  <span className="layout-count">{preset.count} panes</span>
                </div>
              </div>
            ))}
          </div>

          <div className="workspace-section-label">AGENTS</div>
          <div className="agents-section">
            {agents.map((agentKey, i) => {
              const info = getAgentInfo(agentKey);
              return (
                <div key={i} className="agent-row">
                  <span className="agent-row-label">Pane {i + 1}:</span>
                  <div className="agent-select-wrapper">
                    <select
                      className="agent-select"
                      value={agentKey}
                      onChange={(e) => handleAgentChange(i, e.target.value)}
                    >
                      {AGENT_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                    <span className="agent-color-dot" style={{ backgroundColor: info.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="workspace-footer">
          <button className="workspace-btn" onClick={onClose}>Cancel</button>
          <button
            className="workspace-btn primary"
            onClick={handleLaunch}
            disabled={launching}
          >
            {launching ? "Launching..." : `Launch ${selectedPreset.count} Agents`}
          </button>
        </div>
      </div>
    </div>
  );
}
