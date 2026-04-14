const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data as T;
}

// For proxied external APIs that return raw JSON (not wrapped in {data: ...})
async function requestRaw<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json as T;
}

export const api = {
  health: () => request<{ status: string }>("GET", "/api/v1/health"),

  // Sessions
  createSession: (agentKey: string, cols = 120, rows = 40) =>
    request<{ session_id: string; agent_key: string }>("POST", "/api/v1/sessions", {
      agent_key: agentKey,
      cols,
      rows,
    }),
  listSessions: () => request<Array<{ id: string; agent_key: string; exited: boolean }>>("GET", "/api/v1/sessions"),
  deleteSession: (id: string) => request<unknown>("DELETE", `/api/v1/sessions/${id}`),

  // Tasks
  createTask: (title: string, agentKey: string) =>
    request<unknown>("POST", "/api/v1/tasks", { title, agent_key: agentKey }),
  listTasks: () => request<unknown[]>("GET", "/api/v1/tasks"),
  updateTask: (id: string, status: string) =>
    request<unknown>("PATCH", `/api/v1/tasks/${id}`, { status }),
  deleteTask: (id: string) => request<unknown>("DELETE", `/api/v1/tasks/${id}`),

  // Setup
  setupStatus: () =>
    request<{
      cli_installed: boolean;
      cli_path: string;
      logged_in: boolean;
      email: string;
      has_api_key: boolean;
      ready: boolean;
    }>("GET", "/api/v1/setup/status"),
  saveKey: (apiKey: string) =>
    request<{ status: string }>("POST", "/api/v1/setup/save-key", { api_key: apiKey }),
  installAgent: () =>
    request<{ status: string; cli_path: string; message: string }>(
      "POST", "/api/v1/setup/install-agent"
    ),
  deviceCode: () =>
    requestRaw<{
      device_code: string;
      user_code: string;
      verification_url: string;
      expires_in: number;
      interval: number;
    }>("POST", "/api/v1/setup/device-code"),
  devicePoll: (deviceCode: string) =>
    requestRaw<{
      access_token?: string;
      email?: string;
      error?: string;
    }>("POST", "/api/v1/setup/device-poll", { device_code: deviceCode }),

  // Upload file, returns server-side path
  uploadFile: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/v1/upload`, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json.data.path as string;
  },
};
