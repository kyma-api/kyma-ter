import { useSessionsStore } from "../../store/sessions";
import { useTasksStore } from "../../store/tasks";
import { useLocksStore } from "../../store/locks";
import { useEventsStore } from "../../store/events";
import { useActiveTab } from "../../store/ui";

export function StatusBar() {
  const sessions = useSessionsStore((s) => s.sessions);
  const tasks = useTasksStore((s) => s.tasks);
  const locks = useLocksStore((s) => s.locks);
  const eventsConnected = useEventsStore((s) => s.connected);
  const activeTab = useActiveTab();
  const activeSessions = sessions.filter((s) => !s.exited);
  const activeTasks = tasks.filter(
    (t) => t.status === "in-progress" || t.status === "in-review"
  );

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">
          {activeSessions.length} session{activeSessions.length !== 1 ? "s" : ""}
        </span>
        {activeTab && (
          <span className="status-item">
            {Object.keys(activeTab.panes).length} pane{Object.keys(activeTab.panes).length !== 1 ? "s" : ""}
          </span>
        )}
        {activeTasks.length > 0 && (
          <span className="status-item status-tasks">
            {activeTasks.length} task{activeTasks.length !== 1 ? "s" : ""} active
          </span>
        )}
        {locks.length > 0 && (
          <span className="status-item status-locks">
            {locks.length} lock{locks.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="status-right">
        <span className={`status-dot ${eventsConnected ? "dot-connected" : "dot-disconnected"}`} />
        <span className="status-item">kyma-ter</span>
      </div>
    </div>
  );
}
