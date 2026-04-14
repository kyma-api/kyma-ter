import { api } from "../api/client";
import { useSessionsStore } from "../store/sessions";
import { useUIStore } from "../store/ui";

export async function spawnAgent(agentKey: string, tabId: string): Promise<string> {
  const sessionId = await useSessionsStore.getState().createSession(agentKey);
  useUIStore.getState().addPane(tabId, sessionId, agentKey);
  return sessionId;
}

export async function spawnShell(tabId: string): Promise<string> {
  const sessionId = await useSessionsStore.getState().createSession("shell");
  useUIStore.getState().addPane(tabId, sessionId, "shell");
  return sessionId;
}

export async function spawnKymaIfReady(
  tabId: string,
  onNeedSetup: () => void
): Promise<string | null> {
  try {
    const status = await api.setupStatus();
    if (status.ready) {
      return await spawnAgent("kyma", tabId);
    } else {
      onNeedSetup();
      return null;
    }
  } catch {
    onNeedSetup();
    return null;
  }
}
