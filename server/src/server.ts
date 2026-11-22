import { createServer, type Server as HttpServer } from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, User } from "../../shared/protocol";
import { RoomStore } from "./rooms";
import { joinSchema, pointSchema, strokePointsSchema, strokeStartSchema } from "./validation";

const USER_COLORS = ["#e4572e", "#2e86ab", "#a23b72", "#3bb273", "#f3a712", "#6c4ab6", "#1b998b"];

interface SocketData {
  roomId?: string;
  user?: User;
}

export interface WhiteboardServer {
  http: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  rooms: RoomStore;
  close: () => Promise<void>;
}

export function createWhiteboardServer(opts: { staticDir?: string; corsOrigin?: string } = {}): WhiteboardServer {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  if (opts.staticDir) {
    app.use(express.static(opts.staticDir));
    // Single-page app: any other path serves index.html.
    app.get(/^\/(?!socket\.io).*/, (_req, res) => res.sendFile(path.join(opts.staticDir!, "index.html")));
  }

  const http = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(http, {
    cors: opts.corsOrigin ? { origin: opts.corsOrigin } : undefined,
    maxHttpBufferSize: 100_000, // 100 KB per message is plenty for a batch of points
  });
  const rooms = new RoomStore();
  let colorIndex = 0;

  io.on("connection", (socket) => {
    const fail = (message: string) => socket.emit("error:message", { message });
    const inRoom = () => (socket.data.roomId && socket.data.user ? { roomId: socket.data.roomId, user: socket.data.user } : null);

    socket.on("room:join", async (payload) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return fail("Invalid room or name");
      if (socket.data.roomId) return fail("Already in a room");

      const user: User = { id: socket.id, name: parsed.data.name, color: USER_COLORS[colorIndex++ % USER_COLORS.length] };
      try {
        const state = rooms.join(parsed.data.roomId, user);
        socket.data = { roomId: parsed.data.roomId, user };
        await socket.join(parsed.data.roomId);
        socket.emit("board:state", state);
        socket.to(parsed.data.roomId).emit("user:joined", user);
      } catch (err) {
        fail((err as Error).message);
      }
    });

    socket.on("stroke:start", (payload) => {
      const ctx = inRoom();
      const parsed = strokeStartSchema.safeParse(payload);
      if (!ctx || !parsed.success) return;
      const stroke = { ...parsed.data, userId: ctx.user.id };
      if (rooms.startStroke(ctx.roomId, stroke)) socket.to(ctx.roomId).emit("stroke:start", stroke);
    });

    socket.on("stroke:points", (payload) => {
      const ctx = inRoom();
      const parsed = strokePointsSchema.safeParse(payload);
      if (!ctx || !parsed.success) return;
      const added = rooms.addPoints(ctx.roomId, ctx.user.id, parsed.data.strokeId, parsed.data.points);
      if (added.length) socket.to(ctx.roomId).emit("stroke:points", { strokeId: parsed.data.strokeId, points: added });
    });

    socket.on("stroke:undo", () => {
      const ctx = inRoom();
      if (!ctx) return;
      const strokeId = rooms.undo(ctx.roomId, ctx.user.id);
      if (strokeId) io.to(ctx.roomId).emit("stroke:remove", { strokeId });
    });

    socket.on("board:clear", () => {
      const ctx = inRoom();
      if (!ctx) return;
      rooms.clear(ctx.roomId);
      io.to(ctx.roomId).emit("board:cleared", { by: ctx.user.name });
    });

    socket.on("cursor:move", (point) => {
      const ctx = inRoom();
      if (!ctx || !pointSchema.safeParse(point).success) return;
      // volatile: if the client is busy, dropping an old cursor position is fine.
      socket.volatile.to(ctx.roomId).emit("cursor:moved", { userId: ctx.user.id, point });
    });

    socket.on("disconnect", () => {
      const ctx = inRoom();
      if (!ctx) return;
      rooms.leave(ctx.roomId, ctx.user.id);
      socket.to(ctx.roomId).emit("user:left", { userId: ctx.user.id });
    });
  });

  // Free memory from boards nobody has used for 30 minutes.
  const sweeper = setInterval(() => rooms.sweep(30 * 60_000), 60_000);
  sweeper.unref();

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        io.close(() => resolve());
      }),
  };
}
