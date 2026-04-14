import type { Task } from "../../types";
import { getAgentInfo } from "../../types";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const agent = getAgentInfo(task.agent_key);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const age = formatAge(task.created_at);

  return (
    <div
      className="task-card"
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      <div className="task-card-header">
        <span className="agent-dot" style={{ backgroundColor: agent.color }} />
        <span className="task-card-agent">{agent.name}</span>
        <span className="task-card-age">{age}</span>
      </div>
      <div className="task-card-title">{task.title}</div>
      {task.description && (
        <div className="task-card-desc">
          {task.description.length > 80
            ? task.description.slice(0, 80) + "..."
            : task.description}
        </div>
      )}
      {task.session_id && (
        <div className="task-card-session">
          {task.session_id.slice(0, 8)}
        </div>
      )}
    </div>
  );
}

function formatAge(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
