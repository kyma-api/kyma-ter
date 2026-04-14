export function createTerminalWS(sessionId: string): WebSocket {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws/terminal/${sessionId}`;
  return new WebSocket(url);
}

export function createEventsWS(): WebSocket {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws/events`;
  return new WebSocket(url);
}
