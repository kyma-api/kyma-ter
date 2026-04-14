import { useState, useRef, useEffect } from "react";
import { useTasksStore } from "../../store/tasks";
import { TaskCard } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import type { Task } from "../../types";

const COLUMNS = [
  { key: "todo", label: "To Do", color: "#71717a" },
  { key: "in-progress", label: "In Progress", color: "#22c55e" },
  { key: "in-review", label: "In Review", color: "#eab308" },
  { key: "complete", label: "Complete", color: "#818cf8" },
] as const;

function AddNoteInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
    setActive(false);
  };

  if (!active) {
    return (
      <button className="add-note-btn" onClick={() => setActive(true)}>
        + Add note
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="add-note-input"
      placeholder="What needs to be done?"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") { setValue(""); setActive(false); }
      }}
    />
  );
}

export function KanbanBoard() {
  const tasks = useTasksStore((s) => s.tasks);
  const createTask = useTasksStore((s) => s.createTask);
  const updateStatus = useTasksStore((s) => s.updateStatus);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      await updateStatus(taskId, status);
    }
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleAddNote = async (title: string) => {
    await createTask(title);
  };

  // Refresh selectedTask from store when tasks update
  const activeSelected = selectedTask
    ? tasks.find((t) => t.id === selectedTask.id) || null
    : null;

  return (
    <>
      <div className="kanban-add-area">
        <AddNoteInput onAdd={handleAddNote} />
      </div>
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#9744;</div>
          <p>No tasks yet</p>
          <p className="empty-hint">Add a note above to get started</p>
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            if (colTasks.length === 0) return null;
            return (
              <div
                key={col.key}
                className={`kanban-column ${dragOverCol === col.key ? "drag-over" : ""}`}
                onDrop={(e) => handleDrop(e, col.key)}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
              >
                <div className="kanban-column-header">
                  <span
                    className="kanban-col-dot"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="kanban-col-label">{col.label}</span>
                  <span className="kanban-col-count">{colTasks.length}</span>
                </div>
                <div className="kanban-column-body">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {activeSelected && (
        <TaskDetail
          task={activeSelected}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
