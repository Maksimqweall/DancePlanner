import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { verifyToken } from "./jwt";

// userId → set of open WebSocket connections
const connections = new Map<string, Set<WebSocket>>();

function register(userId: string, ws: WebSocket) {
  let bucket = connections.get(userId);
  if (!bucket) {
    bucket = new Set();
    connections.set(userId, bucket);
  }
  bucket.add(ws);
  ws.on("close", () => {
    bucket!.delete(ws);
    if (bucket!.size === 0) connections.delete(userId);
  });
}

export function notify(userId: string, event: Record<string, unknown>) {
  const bucket = connections.get(userId);
  if (!bucket) return;
  const msg = JSON.stringify(event);
  for (const ws of bucket) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function attachWsServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const { userId } = verifyToken(token);
      register(userId, ws);
      ws.send(JSON.stringify({ type: "connected" }));
      // Keep-alive pings
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 25000);
      ws.on("close", () => clearInterval(ping));
    } catch {
      ws.close(1008, "Unauthorized");
    }
  });
}
