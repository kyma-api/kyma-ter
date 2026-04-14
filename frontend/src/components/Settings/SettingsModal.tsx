import { useState, useEffect, useCallback } from "react";
import { useSettingsStore, formatBinding, type ShortcutBinding } from "../../store/settings";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
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

      // Ignore bare modifier keys
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

      // Auto-confirm if no conflict
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
    <div className="setup-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workspace-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-body">
          <div className="workspace-section-label">KEYBOARD SHORTCUTS</div>
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
    </div>
  );
}
