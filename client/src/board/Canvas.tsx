import { useEffect, useRef } from "react";
import type { Point, Stroke, User } from "../../../shared/protocol";
import { toBoardPoint } from "./reducer";

interface Props {
  strokes: Stroke[];
  cursors: Record<string, Point>;
  users: User[];
  myId: string | null;
  color: string;
  width: number;
  onStart: (point: Point) => string;
  onExtend: (strokeId: string, point: Point) => void;
  onCursor: (point: Point) => void;
}

export function Canvas({ strokes, cursors, users, myId, color, width, onStart, onExtend, onCursor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<string | null>(null);

  // Redraw everything when strokes change or the window is resized.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width: w, height: h } = canvas.getBoundingClientRect();
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
        // A single point still shows up as a dot.
        if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x * w + 0.01, stroke.points[0].y * h);
        for (const p of stroke.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
        ctx.stroke();
      }
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [strokes]);

  const pointFrom = (e: React.PointerEvent) => toBoardPoint(e.clientX, e.clientY, canvasRef.current!.getBoundingClientRect());

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ cursor: "crosshair" }}
        aria-label="Drawing board"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = onStart(pointFrom(e));
        }}
        onPointerMove={(e) => {
          const point = pointFrom(e);
          onCursor(point);
          if (drawing.current) onExtend(drawing.current, point);
        }}
        onPointerUp={() => (drawing.current = null)}
        onPointerCancel={() => (drawing.current = null)}
      />
      {users
        .filter((u) => u.id !== myId && cursors[u.id])
        .map((u) => (
          <div
            key={u.id}
            className="cursor"
            style={{ left: `${cursors[u.id].x * 100}%`, top: `${cursors[u.id].y * 100}%`, color: u.color }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 1 L13 6 L7 7.5 L5.5 13 Z" fill="currentColor" stroke="white" strokeWidth="1" />
            </svg>
            <span style={{ background: u.color }}>{u.name}</span>
          </div>
        ))}
      {/* keep `color`/`width` in the props for the preview dot */}
      <div className="preview" style={{ background: color, width, height: width }} aria-hidden="true" />
    </div>
  );
}
