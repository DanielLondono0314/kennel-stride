import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SignaturePadHandle {
  /** PNG con fondo transparente, o null si no se ha firmado. */
  toDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void;
  className?: string;
  invalid?: boolean;
}

/** Recuadro para firmar con el dedo, lápiz o mouse (pointer events). */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onChange, className, invalid },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const setInk = useCallback(
    (v: boolean) => {
      setHasInk(v);
      onChange?.(v);
    },
    [onChange]
  );

  // Resolución real = tamaño en pantalla × devicePixelRatio (trazo nítido).
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#111";
    setInk(false);
  }, [setInk]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setInk(true);
  };

  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setInk(false);
  }, [setInk]);

  useImperativeHandle(ref, () => ({
    toDataUrl: () => (hasInk && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
    clear,
  }), [hasInk, clear]);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed bg-white",
          invalid ? "border-destructive" : "border-muted-foreground/30"
        )}
      >
        <canvas
          ref={canvasRef}
          className="block h-44 w-full touch-none cursor-crosshair rounded-lg"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Recuadro de firma: dibuja tu firma con el dedo o el mouse"
          role="img"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            Firma aquí
          </span>
        )}
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-neutral-300" />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
        <Eraser className="h-4 w-4 mr-2" /> Borrar firma
      </Button>
    </div>
  );
});
