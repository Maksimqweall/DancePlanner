import { WS_BASE_URL } from "../config";
import { tokenStorage } from "./tokenStorage";

// Lazy imports at call time to avoid circular deps at module load
function getStores() {
  const { useFinanceStore } = require("../store/useFinanceStore");
  const { useScheduleStore } = require("../store/useScheduleStore");
  const { usePartnerStore } = require("../store/usePartnerStore");
  return { useFinanceStore, useScheduleStore, usePartnerStore };
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

function clearReconnect() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (stopped) return;
  clearReconnect();
  reconnectTimer = setTimeout(() => connectSync(), 4000);
}

export async function connectSync() {
  if (stopped) return;
  if (socket && socket.readyState === WebSocket.OPEN) return;

  const token = await tokenStorage.get();
  if (!token) return;

  try {
    socket = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    clearReconnect();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { type: string; resource?: string };
      if (msg.type !== "sync" || !msg.resource) return;

      const { useFinanceStore, useScheduleStore, usePartnerStore } = getStores();
      switch (msg.resource) {
        case "expenses":
          useFinanceStore.getState().refresh();
          usePartnerStore.getState().fetchSplit();
          break;
        case "schedule":
          useScheduleStore.getState().fetchMonth(useScheduleStore.getState().viewMonth);
          break;
        case "proposals":
          usePartnerStore.getState().fetchProposals();
          usePartnerStore.getState().fetchPartner();
          break;
      }
    } catch {
      // ignore malformed messages
    }
  };

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function disconnectSync() {
  stopped = true;
  clearReconnect();
  if (socket) {
    socket.onclose = null; // prevent reconnect loop
    socket.close();
    socket = null;
  }
}

export function restartSync() {
  stopped = false;
  disconnectSync();
  stopped = false;
  connectSync();
}
