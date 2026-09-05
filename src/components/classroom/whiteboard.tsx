import { Circle, Download, Eraser, Highlighter, Minus, Pencil, Square, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";

type ToolType = "pen" | "highlighter" | "eraser" | "line" | "rect" | "circle";

type CanvasEvent =
  | React.PointerEvent<HTMLCanvasElement>
  | React.MouseEvent<HTMLCanvasElement>
  | React.TouchEvent<HTMLCanvasElement>;

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
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<any>(null);

  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);
  const [allowStudentDraw, setAllowStudentDraw] = useState(true);

  // Throttled point buffer for realtime stroke broadcasting
  const pendingStrokeBuffer = useRef<
    Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>
  >([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userCanDraw = isTeacher || (canDraw && allowStudentDraw);

  // Synchronize offscreen buffer & resize canvas properly
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;

    // Preserve existing drawing onto offscreen canvas before resizing
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenCanvasRef.current;
    if (canvas.width > 0 && canvas.height > 0) {
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext("2d");
      if (offCtx) {
        offCtx.drawImage(canvas, 0, 0);
      }
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (offscreen.width > 0 && offscreen.height > 0) {
        ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
      }
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Flush batched stroke coordinates to avoid Supabase Realtime rate-limit saturation
  const flushStrokeBuffer = useCallback(() => {
    if (!channelRef.current || pendingStrokeBuffer.current.length === 0) return;
    const segments = [...pendingStrokeBuffer.current];
    pendingStrokeBuffer.current = [];

    channelRef.current.send({
      type: "broadcast",
      event: "draw_action",
      payload: {
        action: "batch_stroke",
        tool,
        color: tool === "eraser" ? "#0f172a" : color,
        width:
          tool === "eraser"
            ? strokeWidth * 3
            : tool === "highlighter"
              ? strokeWidth * 2
              : strokeWidth,
        segments,
      },
    });
  }, [tool, color, strokeWidth]);

  // Supabase Realtime synchronization for Whiteboard
  useEffect(() => {
    if (!classId) return;

    const channel = supabase.channel(`classroom:${classId}:whiteboard`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "draw_action" }, ({ payload }: { payload: any }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (payload.action === "clear") {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
        } else if (payload.action === "batch_stroke" || payload.action === "stroke") {
          ctx.save();
          ctx.strokeStyle = payload.color;
          ctx.lineWidth = payload.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          if (payload.tool === "highlighter") {
            ctx.globalAlpha = 0.35;
          }

          if (payload.action === "batch_stroke" && Array.isArray(payload.segments)) {
            payload.segments.forEach((seg: any) => {
              ctx.beginPath();
              ctx.moveTo(seg.from.x, seg.from.y);
              ctx.lineTo(seg.to.x, seg.to.y);
              ctx.stroke();
            });
          } else if (payload.from && payload.to) {
            ctx.beginPath();
            ctx.moveTo(payload.from.x, payload.from.y);
            ctx.lineTo(payload.to.x, payload.to.y);
            ctx.stroke();
          }
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
          } else if (payload.shape === "line") {
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
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [classId]);

  const broadcastAction = (payload: any) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "draw_action",
        payload,
      });
    }
  };

  const getCanvasCoords = (e: CanvasEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0]!;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    return { x: 0, y: 0 };
  };

  const startDrawing = (e: CanvasEvent) => {
    if (!userCanDraw) {
      toast.info("Whiteboard is in view-only mode for students");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if ("pointerId" in e) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const pos = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(pos);

    try {
      setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch {
      // ignore
    }

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: CanvasEvent) => {
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

      // Buffer stroke segments and batch flush every 40ms to stay within Realtime rate limits
      pendingStrokeBuffer.current.push({ from: startPos, to: currentPos });

      if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushStrokeBuffer();
          flushTimeoutRef.current = null;
        }, 40);
      }

      setStartPos(currentPos);
    } else if (snapshot) {
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

  const stopDrawing = (e?: CanvasEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (e && "pointerId" in e) {
      try {
        if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
          canvasRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !startPos) return;

    const endPos = e ? getCanvasCoords(e) : startPos;

    // Flush any pending strokes immediately
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    flushStrokeBuffer();

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

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

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
      <div className="flex max-w-full flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/80 p-2 sm:p-2.5 overflow-x-auto">
        {/* Tools */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("pen")}
            aria-label="Select pen tool"
            title="Pen"
          >
            <Pencil className="size-3.5 mr-1" /> Pen
          </Button>
          <Button
            size="sm"
            variant={tool === "highlighter" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("highlighter")}
            aria-label="Select highlighter marker tool"
            title="Highlighter"
          >
            <Highlighter className="size-3.5 mr-1" /> Marker
          </Button>
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("eraser")}
            aria-label="Select eraser tool"
            title="Eraser"
          >
            <Eraser className="size-3.5 mr-1" /> Eraser
          </Button>
          <Button
            size="sm"
            variant={tool === "rect" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("rect")}
            aria-label="Select rectangle shape tool"
            title="Rectangle"
          >
            <Square className="size-3.5 mr-1" /> Rect
          </Button>
          <Button
            size="sm"
            variant={tool === "circle" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("circle")}
            aria-label="Select circle shape tool"
            title="Circle"
          >
            <Circle className="size-3.5 mr-1" /> Circle
          </Button>
          <Button
            size="sm"
            variant={tool === "line" ? "default" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() => setTool("line")}
            aria-label="Select line shape tool"
            title="Line"
          >
            <Minus className="size-3.5 mr-1" /> Line
          </Button>
        </div>

        {/* Color Palette & Stroke */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Select color ${c}`}
                className="flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none"
                onClick={() => setColor(c)}
              >
                <span
                  className={cn(
                    "size-4 rounded-full border border-white/20 transition-transform",
                    color === c
                      ? "scale-125 ring-2 ring-primary ring-offset-1 ring-offset-slate-900"
                      : "",
                  )}
                  style={{ backgroundColor: c }}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            {STROKES.map((s) => (
              <button
                key={s.width}
                type="button"
                aria-label={`Set stroke width ${s.label}`}
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
        <div className="flex items-center gap-1 shrink-0">
          {isTeacher ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={toggleStudentDraw}
              aria-label={
                allowStudentDraw
                  ? "Lock whiteboard for students"
                  : "Allow students to draw on whiteboard"
              }
            >
              {allowStudentDraw ? "Lock for Students" : "Allow Student Draw"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={clearBoard}
            aria-label="Clear whiteboard canvas"
            title="Clear canvas"
          >
            <Trash2 className="size-3.5 mr-1" /> Clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={downloadBoard}
            aria-label="Export whiteboard as PNG"
            title="Export PNG"
          >
            <Download className="size-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Canvas Area with touch-action: none for mobile, stylus, and touch tablets */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full min-h-[460px] bg-slate-950 cursor-crosshair touch-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          className="absolute inset-0 block w-full h-full touch-none"
        />
      </div>
    </div>
  );
}
