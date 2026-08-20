import {
  Circle,
  Download,
  Eraser,
  Highlighter,
  Minus,
  MoveRight,
  Pencil,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";

type ToolType = "pen" | "highlighter" | "eraser" | "line" | "arrow" | "rect" | "circle" | "text";

interface WhiteboardProps {
  classId: string;
  isTeacher: boolean;
  canDraw?: boolean;
}

const COLORS = ["#ffffff", "#facc15", "#38bdf8", "#4ade80", "#f43f5e", "#c084fc", "#fb923c"];

const STROKES = [
  { label: "Fine", width: 2 },
  { label: "Medium", width: 4 },
  { label: "Thick", width: 8 },
  { label: "Marker", width: 14 },
];

export function CollaborativeWhiteboard({ classId, isTeacher, canDraw = true }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [allowStudentDraw, setAllowStudentDraw] = useState(true);

  const userCanDraw = isTeacher || (canDraw && allowStudentDraw);

  // Resize canvas to fill parent container cleanly
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save previous content if any
    const ctx = canvas.getContext("2d");
    let prevData: ImageData | null = null;
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      try {
        prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        // ignore on clean canvas
      }
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, rect.width, rect.height);
      if (prevData) {
        ctx.putImageData(prevData, 0, 0);
      }
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Supabase Realtime synchronization for Whiteboard
  useEffect(() => {
    if (!classId) return;

    const channel = supabase.channel(`classroom:${classId}:whiteboard`);

    channel
      .on("broadcast", { event: "draw_action" }, ({ payload }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (payload.action === "clear") {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, rect.width, rect.height);
          }
        } else if (payload.action === "stroke") {
          ctx.save();
          ctx.strokeStyle = payload.color;
          ctx.lineWidth = payload.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          if (payload.tool === "highlighter") {
            ctx.globalAlpha = 0.35;
          }

          ctx.beginPath();
          ctx.moveTo(payload.from.x, payload.from.y);
          ctx.lineTo(payload.to.x, payload.to.y);
          ctx.stroke();
          ctx.restore();
        } else if (payload.action === "shape") {
          ctx.save();
          ctx.strokeStyle = payload.color;
          ctx.lineWidth = payload.width;
          ctx.lineCap = "round";
          ctx.beginPath();

          if (payload.shape === "rect") {
            ctx.strokeRect(payload.x, payload.y, payload.w, payload.h);
          } else if (payload.shape === "circle") {
            ctx.beginPath();
            ctx.arc(payload.cx, payload.cy, payload.radius, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (payload.shape === "line" || payload.shape === "arrow") {
            ctx.moveTo(payload.x1, payload.y1);
            ctx.lineTo(payload.x2, payload.y2);
            ctx.stroke();
          }
          ctx.restore();
        } else if (payload.action === "permission_toggle") {
          setAllowStudentDraw(payload.allowed);
          toast.info(
            payload.allowed
              ? "Teacher enabled student whiteboard drawing"
              : "Teacher restricted whiteboard drawing to faculty only",
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  const broadcastAction = (payload: any) => {
    const channel = supabase.channel(`classroom:${classId}:whiteboard`);
    channel.send({
      type: "broadcast",
      event: "draw_action",
      payload,
    });
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!userCanDraw) {
      toast.info("Whiteboard is in view-only mode for students");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pos = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(pos);

    try {
      setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch (err) {
      // ignore
    }

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !userCanDraw) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !startPos) return;

    const currentPos = getCanvasCoords(e);

    ctx.save();
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = strokeWidth * 3;
    } else {
      ctx.strokeStyle = color;
      if (tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = strokeWidth * 2;
      }
    }

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();

      broadcastAction({
        action: "stroke",
        tool,
        color: tool === "eraser" ? "#0f172a" : color,
        width:
          tool === "eraser"
            ? strokeWidth * 3
            : tool === "highlighter"
              ? strokeWidth * 2
              : strokeWidth,
        from: startPos,
        to: currentPos,
      });

      setStartPos(currentPos);
    } else if (snapshot) {
      // Shape preview: restore clean snapshot first
      ctx.putImageData(snapshot, 0, 0);
      ctx.beginPath();

      if (tool === "rect") {
        const w = currentPos.x - startPos.x;
        const h = currentPos.y - startPos.y;
        ctx.strokeRect(startPos.x, startPos.y, w, h);
      } else if (tool === "circle") {
        const radius = Math.sqrt(
          Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2),
        );
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === "line") {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !startPos) return;

    const endPos = getCanvasCoords(e);

    if (tool === "rect" || tool === "circle" || tool === "line") {
      const shapePayload: any = { action: "shape", color, width: strokeWidth };
      if (tool === "rect") {
        shapePayload.shape = "rect";
        shapePayload.x = startPos.x;
        shapePayload.y = startPos.y;
        shapePayload.w = endPos.x - startPos.x;
        shapePayload.h = endPos.y - startPos.y;
      } else if (tool === "circle") {
        shapePayload.shape = "circle";
        shapePayload.cx = startPos.x;
        shapePayload.cy = startPos.y;
        shapePayload.radius = Math.sqrt(
          Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2),
        );
      } else if (tool === "line") {
        shapePayload.shape = "line";
        shapePayload.x1 = startPos.x;
        shapePayload.y1 = startPos.y;
        shapePayload.x2 = endPos.x;
        shapePayload.y2 = endPos.y;
      }
      broadcastAction(shapePayload);
    }

    setStartPos(null);
    setSnapshot(null);
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !container) return;

    const rect = container.getBoundingClientRect();
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, rect.width, rect.height);

    broadcastAction({ action: "clear" });
    toast.success("Whiteboard cleared");
  };

  const downloadBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = image;
    a.download = `edulive-whiteboard-${Date.now()}.png`;
    a.click();
    toast.success("Whiteboard exported as PNG");
  };

  const toggleStudentDraw = () => {
    const nextState = !allowStudentDraw;
    setAllowStudentDraw(nextState);
    broadcastAction({ action: "permission_toggle", allowed: nextState });
    toast.success(nextState ? "Student drawing enabled" : "Student drawing disabled");
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-slate-900 overflow-hidden select-none">
      {/* Whiteboard Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/80 p-2.5">
        {/* Tools */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("pen")}
            title="Pen"
          >
            <Pencil className="size-3.5 mr-1" /> Pen
          </Button>
          <Button
            size="sm"
            variant={tool === "highlighter" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("highlighter")}
            title="Highlighter"
          >
            <Highlighter className="size-3.5 mr-1" /> Marker
          </Button>
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("eraser")}
            title="Eraser"
          >
            <Eraser className="size-3.5 mr-1" /> Eraser
          </Button>
          <Button
            size="sm"
            variant={tool === "rect" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("rect")}
            title="Rectangle"
          >
            <Square className="size-3.5 mr-1" /> Rect
          </Button>
          <Button
            size="sm"
            variant={tool === "circle" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("circle")}
            title="Circle"
          >
            <Circle className="size-3.5 mr-1" /> Circle
          </Button>
          <Button
            size="sm"
            variant={tool === "line" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("line")}
            title="Line"
          >
            <Minus className="size-3.5 mr-1" /> Line
          </Button>
        </div>

        {/* Color Palette & Stroke */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  "size-5 rounded-full border border-white/20 transition-transform",
                  color === c
                    ? "scale-125 ring-2 ring-primary ring-offset-1 ring-offset-slate-900"
                    : "hover:scale-110",
                )}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            {STROKES.map((s) => (
              <button
                key={s.width}
                type="button"
                onClick={() => setStrokeWidth(s.width)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] transition-colors",
                  strokeWidth === s.width
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-slate-400 hover:bg-white/10",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions & Teacher Controls */}
        <div className="flex items-center gap-1">
          {isTeacher ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={toggleStudentDraw}
            >
              {allowStudentDraw ? "Lock for Students" : "Allow Student Draw"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={clearBoard}
            title="Clear canvas"
          >
            <Trash2 className="size-3.5 mr-1" /> Clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={downloadBoard}
            title="Export PNG"
          >
            <Download className="size-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full min-h-[460px] bg-slate-950 cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="absolute inset-0 block w-full h-full"
        />
      </div>
    </div>
  );
}
