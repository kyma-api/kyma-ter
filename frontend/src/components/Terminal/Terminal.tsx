import { useCallback, useState, useEffect } from "react";
import { useTerminal } from "./useTerminal";
import { getAgentInfo } from "../../types";
import { useTasksStore } from "../../store/tasks";
import { useLocksStore } from "../../store/locks";
import { DropZoneOverlay } from "./DropZoneOverlay";
import type { DropZone } from "../../utils/layoutTree";
import "@xterm/xterm/css/xterm.css";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  "todo": { label: "TODO", className: "badge-todo" },
  "in-progress": { label: "RUNNING", className: "badge-running" },
  "in-review": { label: "REVIEW", className: "badge-review" },
  "complete": { label: "DONE", className: "badge-done" },
};

interface TerminalProps {
  sessionId: string;
  agentKey: string;
  paneId?: string;
  focused?: boolean;
  singlePane?: boolean;
  onClose?: () => void;
  onMoveDrop?: (draggedPaneId: string, zone: DropZone) => void;
  onFocus?: () => void;
}

export function TerminalPane({ sessionId, agentKey, paneId, focused, singlePane, onClose, onMoveDrop, onFocus }: TerminalProps) {
  const agent = getAgentInfo(agentKey);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const task = useTasksStore((s) =>
    s.tasks.find((t) => t.session_id === sessionId)
  );
  const lockCount = useLocksStore((s) =>
    s.locks.filter((l) => l.session_id === sessionId).length
  );

  const handleExit = useCallback(
    (_exitCode: number) => {},
    []
  );

  const { containerRef, termRef } = useTerminal({
    sessionId,
    onExit: handleExit,
  });

  // Auto-focus xterm when this pane becomes focused
  useEffect(() => {
    if (focused && termRef.current) {
      termRef.current.focus();
    }
  }, [focused, termRef]);

  const statusInfo = task ? STATUS_LABELS[task.status] : null;

  const paneClasses = [
    "terminal-pane",
    dragging ? "dragging" : "",
    focused && !singlePane ? "focused" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={paneClasses}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("text/pane-id")) {
          setDragOver(true);
        }
      }}
      onMouseDown={onFocus}
    >
      <div
        className="terminal-header"
        draggable
        onDragStart={(e) => {
          if (paneId) {
            e.dataTransfer.setData("text/pane-id", paneId);
            e.dataTransfer.effectAllowed = "move";
            setDragging(true);
          }
        }}
        onDragEnd={() => {
          setDragging(false);
          setDragOver(false);
        }}
      >
        <div className="terminal-header-left">
          <span className="agent-dot" style={{ backgroundColor: agent.color }} />
          <span className="agent-name">{agent.name || "Shell"}</span>
          {task && (
            <>
              <span className="header-sep">&middot;</span>
              <span className="task-title" title={task.title}>
                {task.title.length > 40
                  ? task.title.slice(0, 40) + "..."
                  : task.title}
              </span>
              {statusInfo && (
                <span className={`task-badge ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              )}
            </>
          )}
          {!task && (
            <span className="session-id">{sessionId.slice(0, 8)}</span>
          )}
        </div>
        <div className="terminal-header-right">
          {lockCount > 0 && (
            <span className="lock-indicator" title={`${lockCount} file lock${lockCount > 1 ? "s" : ""}`}>
              L {lockCount}
            </span>
          )}
          {onClose && (
            <button className="close-btn" onClick={onClose} title="Close">
              &times;
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="terminal-container" />
      {dragOver && paneId && onMoveDrop && (
        <DropZoneOverlay
          targetPaneId={paneId}
          onMoveDrop={onMoveDrop}
          onDragLeave={() => setDragOver(false)}
        />
      )}
    </div>
  );
}
