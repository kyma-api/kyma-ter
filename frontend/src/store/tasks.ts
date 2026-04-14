import { create } from "zustand";
import { api } from "../api/client";
import type { Task } from "../types";

interface TasksState {
  tasks: Task[];
  loading: boolean;
  fetch: () => Promise<void>;
  createTask: (title: string, description?: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTaskForSession: (sessionId: string) => Task | undefined;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.listTasks();
      set({ tasks: data as Task[] });
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (title: string, description?: string) => {
    await api.createTask(title, description);
    await get().fetch();
  },

  updateStatus: async (id: string, status: string) => {
    await api.updateTask(id, status);
    await get().fetch();
  },

  deleteTask: async (id: string) => {
    await api.deleteTask(id);
    await get().fetch();
  },

  getTaskForSession: (sessionId: string) => {
    return get().tasks.find((t) => t.session_id === sessionId);
  },
}));
