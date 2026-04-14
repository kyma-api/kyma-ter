import { create } from "zustand";
import { createEventsWS } from "../api/ws";
import { useSessionsStore } from "./sessions";
import { useTasksStore } from "./tasks";
import { useLocksStore } from "./locks";
import { useUIStore } from "./ui";

interface EventData {
  event: string;
  data?: Record<string, unknown>;
  action?: string;
}

interface EventsState {
  connected: boolean;
  ws: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  connected: false,
  ws: null,

  connect: () => {
    if (get().ws) return;

    const ws = createEventsWS();

    ws.onopen = () => {
      set({ connected: true });
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      // Auto-reconnect after 2s
      setTimeout(() => {
        if (!get().ws) get().connect();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (ev) => {
      try {
        const msg: EventData = JSON.parse(ev.data);
        handleEvent(msg);
      } catch {
        // ignore malformed messages
      }
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, connected: false });
    }
  },
}));

function handleEvent(msg: EventData) {
  const data = msg.data || {};

  switch (msg.event) {
    case "session_created":
      useSessionsStore.getState().fetch();
      break;

    case "session_exited":
      useSessionsStore.getState().fetch();
      break;

    case "task_created":
    case "task_update":
      useTasksStore.getState().fetch();
      break;

    case "task_dispatched": {
      useTasksStore.getState().fetch();
      // Auto-add pane for dispatched task if session is new
      const sessionId = data.session_id as string;
      const agentKey = data.agent_key as string;
      if (sessionId) {
        const ui = useUIStore.getState();
        const activeTab = ui.tabs.find((t) => t.id === ui.activeTabId);
        const alreadyHasPane = activeTab?.panes.some(
          (p) => p.sessionId === sessionId
        );
        if (!alreadyHasPane) {
          ui.addPane(ui.activeTabId, sessionId, agentKey || "");
        }
      }
      useSessionsStore.getState().fetch();
      break;
    }

    case "filelock":
      useLocksStore.getState().fetch();
      break;

    case "message":
      // Will be used in Phase 5
      break;
  }
}
