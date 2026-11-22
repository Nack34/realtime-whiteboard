import { z } from "zod";

// Never trust payloads from the socket: a malicious client could send anything.
const coordinate = z.number().finite().min(0).max(1);
export const pointSchema = z.object({ x: coordinate, y: coordinate });
export const pointsSchema = z.array(pointSchema).min(1).max(500);

export const joinSchema = z.object({
  roomId: z.string().regex(/^[a-zA-Z0-9_-]{3,40}$/),
  name: z.string().trim().min(1).max(30),
});

export const strokeStartSchema = z.object({
  id: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(1).max(40),
  points: z.array(pointSchema).max(500),
});

export const strokePointsSchema = z.object({
  strokeId: z.string().min(1).max(64),
  points: pointsSchema,
});
