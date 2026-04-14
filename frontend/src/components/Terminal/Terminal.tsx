import { useCallback } from "react";
import { useTerminal } from "./useTerminal";
import { getAgentInfo } from "../../types";
import { useTasksStore } from "../../store/tasks";
import { useLocksStore } from "../../store/locks";
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
  onClose?: () => void;
}

export function TerminalPane({ sessionId, agentKey, onClose }: TerminalProps) {
  const agent = getAgentInfo(agentKey);
  const task = useTasksStore((s) =>
    s.tasks.find((t) => t.session_id === sessionId)
  );
  const lockCount = useLocksStore((s) =>
    s.locks.filter((l) => l.session_id === sessionId).length
  );

  const handleExit = useCallback(
    (_exitCode: number) => {
      // Could auto-close or show restart button
    },
    []
  );

  const { containerRef } = useTerminal({
    sessionId,
    onExit: handleExit,
  });

  const statusInfo = task ? STATUS_LABELS[task.status] : null;

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
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
    </div>
  );
}
