import { useState, useEffect, useCallback } from "react";
import { DEFAULT_AGENTS, getAgentInfo } from "../../types";
import { useSessionsStore } from "../../store/sessions";
import { useUIStore } from "../../store/ui";
import { useSettingsStore, formatBinding, type ShortcutBinding } from "../../store/settings";
import { api } from "../../api/client";

// ── Layout Presets (reused from AgentWorkspaceModal) ─────────────────
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

type Section = "workspace" | "shortcuts";

export function SettingsPage() {
  const [section, setSection] = useState<Section>("workspace");

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <div className="settings-nav-title">Settings</div>
        <button
          className={`settings-nav-item ${section === "workspace" ? "active" : ""}`}
          onClick={() => setSection("workspace")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Agent Workspace
        </button>
        <button
          className={`settings-nav-item ${section === "shortcuts" ? "active" : ""}`}
          onClick={() => setSection("shortcuts")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="8" x2="6" y2="8" />
            <line x1="10" y1="8" x2="10" y2="8" />
            <line x1="14" y1="8" x2="14" y2="8" />
            <line x1="18" y1="8" x2="18" y2="8" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="8" y1="16" x2="16" y2="16" />
          </svg>
          Keyboard Shortcuts
        </button>
      </nav>
      <div className="settings-content">
        {section === "workspace" ? <WorkspaceSection /> : <ShortcutsSection />}
      </div>
    </div>
  );
}

// ── Agent Workspace Section ──────────────────────────────────────────
function WorkspaceSection() {
  const [selectedPreset, setSelectedPreset] = useState<LayoutPreset>(PRESETS[1]);
  const [agents, setAgents] = useState<string[]>(() => Array(PRESETS[1].count).fill("kyma"));
  const [launching, setLaunching] = useState(false);

  const handlePresetChange = (preset: LayoutPreset) => {
    setSelectedPreset(preset);
    setAgents((prev) => {
      const next = Array(preset.count).fill("kyma");
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
      const hasKyma = agents.some((a) => a !== "shell");
      if (hasKyma) {
        const status = await api.setupStatus();
        if (!status.ready) {
          alert("Please complete Kyma Agent setup first (click Agent button in sidebar).");
          setLaunching(false);
          return;
        }
      }

      const createSession = useSessionsStore.getState().createSession;
      const panes: Array<{ sessionId: string; agentKey: string }> = [];
      for (const agentKey of agents) {
        const sessionId = await createSession(agentKey);
        panes.push({ sessionId, agentKey });
      }

      const ui = useUIStore.getState();
      // Always create a new tab for workspace launch from settings
      const targetTabId = ui.addTab();
      ui.launchWorkspace(targetTabId, panes, selectedPreset.cols, selectedPreset.rows);
    } catch (err) {
      console.error("Failed to launch workspace:", err);
    }
    setLaunching(false);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Agent Workspace</h3>
      <p className="settings-section-desc">Launch multiple agents in a grid layout. Select a preset and assign agents to each pane.</p>

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

      <div className="settings-section-actions">
        <button
          className="workspace-btn primary"
          onClick={handleLaunch}
          disabled={launching}
        >
          {launching ? "Launching..." : `Launch ${selectedPreset.count} Agents`}
        </button>
      </div>
    </div>
  );
}

// ── Keyboard Shortcuts Section ───────────────────────────────────────
function ShortcutsSection() {
  const { shortcuts, updateShortcut, resetDefaults } = useSettingsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [pendingBinding, setPendingBinding] = useState<ShortcutBinding | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const checkConflict = useCallback((binding: ShortcutBinding, excludeId: string): string | null => {
    for (const sc of shortcuts) {
      if (sc.id === excludeId) continue;
      if (
        sc.binding.key.toLowerCase() === binding.key.toLowerCase() &&
        sc.binding.metaKey === binding.metaKey &&
        sc.binding.shiftKey === binding.shiftKey &&
        sc.binding.ctrlKey === binding.ctrlKey
      ) {
        return sc.label;
      }
    }
    return null;
  }, [shortcuts]);

  useEffect(() => {
    if (!recordingId) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (["Meta", "Shift", "Control", "Alt"].includes(e.key)) return;

      if (e.key === "Escape") {
        setRecordingId(null);
        setPendingBinding(null);
        setConflict(null);
        return;
      }

      const binding: ShortcutBinding = {
        key: e.key.toLowerCase(),
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
      };

      const conflictLabel = checkConflict(binding, recordingId);
      setConflict(conflictLabel);
      setPendingBinding(binding);

      if (!conflictLabel) {
        updateShortcut(recordingId, binding);
        setRecordingId(null);
        setPendingBinding(null);
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [recordingId, checkConflict, updateShortcut]);

  const confirmPending = () => {
    if (recordingId && pendingBinding) {
      updateShortcut(recordingId, pendingBinding);
      setRecordingId(null);
      setPendingBinding(null);
      setConflict(null);
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Keyboard Shortcuts</h3>
      <p className="settings-section-desc">Click a shortcut to record a new binding. Press Escape to cancel.</p>

      <div className="shortcut-list">
        {shortcuts.map((sc) => (
          <div key={sc.id} className="shortcut-row">
            <span className="shortcut-label">{sc.label}</span>
            <button
              className={`shortcut-badge ${recordingId === sc.id ? "recording" : ""}`}
              onClick={() => {
                setRecordingId(sc.id);
                setPendingBinding(null);
                setConflict(null);
              }}
            >
              {recordingId === sc.id
                ? (pendingBinding ? formatBinding(pendingBinding) : "Press keys...")
                : formatBinding(sc.binding)
              }
            </button>
          </div>
        ))}
      </div>

      {conflict && (
        <div className="shortcut-conflict">
          Conflicts with "{conflict}".{" "}
          <button className="shortcut-conflict-btn" onClick={confirmPending}>
            Override
          </button>
        </div>
      )}

      <div className="settings-section-actions">
        <button className="settings-reset-btn" onClick={() => {
          resetDefaults();
          setRecordingId(null);
          setPendingBinding(null);
          setConflict(null);
        }}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
