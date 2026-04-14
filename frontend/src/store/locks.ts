import { create } from "zustand";
import type { FileLock } from "../types";

interface LocksState {
  locks: FileLock[];
  loading: boolean;
  fetch: () => Promise<void>;
  getLocksForSession: (sessionId: string) => FileLock[];
}

export const useLocksStore = create<LocksState>((set, get) => ({
  locks: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/v1/locks");
      const json = await res.json();
      set({ locks: (json.data || []) as FileLock[] });
    } finally {
      set({ loading: false });
    }
  },

  getLocksForSession: (sessionId: string) => {
    return get().locks.filter((l) => l.session_id === sessionId);
  },
}));
