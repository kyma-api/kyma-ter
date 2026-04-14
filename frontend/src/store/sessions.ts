import { create } from "zustand";
import { api } from "../api/client";
import type { SessionInfo } from "../types";

interface SessionsState {
  sessions: SessionInfo[];
  loading: boolean;
  fetch: () => Promise<void>;
  createSession: (agentKey: string) => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.listSessions();
      set({ sessions: data as SessionInfo[] });
    } finally {
      set({ loading: false });
    }
  },

  createSession: async (agentKey: string) => {
    const data = await api.createSession(agentKey);
    await get().fetch();
    return data.session_id;
  },

  deleteSession: async (id: string) => {
    await api.deleteSession(id);
    await get().fetch();
  },
}));
