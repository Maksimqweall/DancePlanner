import { WS_BASE_URL } from "../config";
import { tokenStorage } from "./tokenStorage";

// Lazy imports at call time to avoid circular deps at module load
function getStores() {
  const { useFinanceStore } = require("../store/useFinanceStore");
  const { useScheduleStore } = require("../store/useScheduleStore");
  const { usePartnerStore } = require("../store/usePartnerStore");
  const { useChatStore } = require("../store/useChatStore");
  return { useFinanceStore, useScheduleStore, usePartnerStore, useChatStore };
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
  // An explicit connect request clears any prior stop (e.g. after logout→login).
  stopped = false;
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

      const { useFinanceStore, useScheduleStore, usePartnerStore, useChatStore } = getStores();

      // New chat / activity-feed message → refresh the feed + unread badge.
      if (msg.type === "message") {
        useChatStore.getState().handleIncoming();
        return;
      }

      if (msg.type !== "sync" || !msg.resource) return;
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
