import type { Task } from "../../types";
import { getAgentInfo } from "../../types";
import { useTasksStore } from "../../store/tasks";

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
}

const STATUS_OPTIONS = ["todo", "in-progress", "in-review", "complete"] as const;

export function TaskDetail({ task, onClose }: TaskDetailProps) {
  const updateStatus = useTasksStore((s) => s.updateStatus);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const agent = getAgentInfo(task.agent_key);

  const handleStatusChange = async (status: string) => {
    await updateStatus(task.id, status);
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onClose();
  };

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-header">
          <h3>{task.title}</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="task-detail-meta">
          <div className="detail-row">
            <span className="detail-label">Agent</span>
            <span className="detail-value">
              <span className="agent-dot" style={{ backgroundColor: agent.color }} />
              {agent.name}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Status</span>
            <div className="detail-value status-buttons">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`status-btn ${task.status === s ? "active" : ""}`}
                  onClick={() => handleStatusChange(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {task.session_id && (
            <div className="detail-row">
              <span className="detail-label">Session</span>
              <span className="detail-value mono">{task.session_id.slice(0, 12)}</span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">Created</span>
            <span className="detail-value">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </div>
        </div>

        {task.description && (
          <div className="task-detail-section">
            <h4>Description</h4>
            <pre className="task-detail-text">{task.description}</pre>
          </div>
        )}

        {task.task_knowledge && (
          <div className="task-detail-section">
            <h4>Context</h4>
            <pre className="task-detail-text">{task.task_knowledge}</pre>
          </div>
        )}

        <div className="task-detail-actions">
          <button className="btn-danger" onClick={handleDelete}>
            Delete Task
          </button>
        </div>
      </div>
    </div>
  );
}
