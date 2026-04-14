export interface SessionInfo {
  id: string;
  agent_key: string;
  cols: number;
  rows: number;
  created_at: number;
  exited: boolean;
  exit_code?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  task_knowledge: string;
  agent_key: string;
  session_id: string;
  status: "todo" | "in-progress" | "in-review" | "complete";
  sort_order: number;
  callback_url: string;
  meta: string;
  created_at: number;
  updated_at: number;
}

export interface FileLock {
  id: string;
  file_path: string;
  session_id: string;
  agent_key: string;
  lock_type: string;
  acquired_at: number;
  expires_at: number;
}

export interface AgentConfig {
  name: string;
  command: string;
  icon: string;
  color: string;
}

export const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  "kyma": { name: "Kyma Agent", command: "kyma", icon: "robot", color: "#06b6d4" },
};

export function getAgentInfo(key: string): AgentConfig {
  return DEFAULT_AGENTS[key] || { name: key || "Shell", command: "", icon: "terminal", color: "#6b7280" };
}
