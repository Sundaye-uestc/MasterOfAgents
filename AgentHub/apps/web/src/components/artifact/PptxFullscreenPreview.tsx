/**
 * Fullscreen PPTX preview modal — reuses pptxviewjs with a viewport-filling canvas.
 *
 * Opened from PptxViewerCard's "全屏" button. Re-fetches the PPTX binary from the
 * same URL (browser serves it from cache), initializes its own viewer instance,
 * and sizes the canvas to fill as much of the viewport as the slide aspect ratio
 * allows (minus room for the control bar).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PPTXViewer as IPPTXViewer } from "pptxviewjs";

interface Props {
  url: string;
  name: string;
  onClose: () => void;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

/** Slide dimensions in EMU from the internal processor */
function getSlideEmu(viewer: IPPTXViewer): { cx: number; cy: number } | null {
  try {
    const proc = (viewer as any).processor;
    if (!proc?.getSlideDimensions) return null;
    const dims = proc.getSlideDimensions();
    if (dims) {
      if (typeof dims.cx === "number" && typeof dims.cy === "number") {
        return { cx: dims.cx, cy: dims.cy };
      }
      if (typeof dims.width === "number" && typeof dims.height === "number") {
        return {
          cx: Math.round(dims.width * 36000),
          cy: Math.round(dims.height * 36000),
        };
      }
    }
  } catch {
    /* degrade gracefully */
  }
  return null;
}

const CONTROLS_HEIGHT = 48;

export function PptxFullscreenPreview({ url, name, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<IPPTXViewer | null>(null);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [slideRatio, setSlideRatio] = useState(9 / 16);
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 540 });
  const slideRatioRef = useRef(slideRatio);
  slideRatioRef.current = slideRatio;
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;
  const touchStartX = useRef(0);
  const loadedRef = useRef(false);

  // Compute canvas size to fill viewport while preserving slide aspect ratio
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight - CONTROLS_HEIGHT;
      const ratio = slideRatioRef.current;
      let w: number, h: number;
      if (vw / vh > 1 / ratio) {
        h = vh;
        w = Math.round(h / ratio);
      } else {
        w = vw;
        h = Math.round(w * ratio);
      }
      setCanvasSize((prev) =>
        prev.w === w && prev.h === h ? prev : { w, h }
      );
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Re-render after canvas size or slide changes
  useEffect(() => {
    if (!loadedRef.current) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.renderSlide(current).catch(() => {});
  }, [canvasSize, current]);

  // Initialize viewer and load PPTX
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { PPTXViewer: Viewer } = await import("pptxviewjs");
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const { w, h } = canvasSizeRef.current;
        canvas.width = w;
        canvas.height = h;

        const viewer = new Viewer({
          canvas,
          slideSizeMode: "fit",
          backgroundColor: "#111",
        });
        viewerRef.current = viewer;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        if (cancelled) return;

        await viewer.loadFile(buffer);
        if (cancelled) return;

        const emu = getSlideEmu(viewer);
        if (emu) {
          const ratio = emu.cy / emu.cx;
          setSlideRatio(ratio);
          const cw = canvasSizeRef.current.w;
          const ch = Math.round(cw * ratio);
          if (ch !== canvas.height) {
            canvas.height = ch;
            setCanvasSize({ w: cw, h: ch });
          }
        }

        const slideCount = viewer.getSlideCount();
        setTotal(slideCount);
        loadedRef.current = true;

        if (slideCount > 0) {
          await viewer.renderSlide(0);
          setCurrent(0);
        }

        if (!cancelled) setState({ phase: "ready" });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      loadedRef.current = false;
    };
  }, [url]);

  const goTo = useCallback(
    async (n: number) => {
      const viewer = viewerRef.current;
      if (!viewer || total === 0) return;
      const idx = Math.max(0, Math.min(total - 1, n));
      setCurrent(idx);
      try {
        await viewer.renderSlide(idx);
      } catch {
        /* ignore transient render errors */
      }
    },
    [total],
  );

  // Keyboard nav + Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goTo(current + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goTo(current - 1); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(total - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, total, goTo, onClose]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches.item(0);
    if (t) touchStartX.current = t.clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches.item(0);
    if (!t) return;
    const dx = t.clientX - touchStartX.current;
    if (Math.abs(dx) > 50) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  };

  // Click edges (20% zones)
  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < rect.width * 0.2) goTo(current - 1);
    else if (relX > rect.width * 0.8) goTo(current + 1);
  };

  const isReady = state.phase === "ready";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Top bar: title + close */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <span className="text-sm text-gray-400 truncate max-w-[80%]">{name}</span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xl leading-none px-2"
          title="关闭 (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Canvas area */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ cursor: isReady ? "pointer" : "default" }}
      >
        {state.phase === "loading" && (
          <span className="text-gray-500 animate-pulse">📊 正在加载 PPT...</span>
        )}
        {state.phase === "error" && (
          <div className="flex flex-col items-center gap-2 text-red-400">
            <span>⚠️ PPT 加载失败</span>
            <span className="text-xs text-red-400/60">{state.message}</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{
            width: `${canvasSize.w}px`,
            height: `${canvasSize.h}px`,
            boxShadow: "0 4px 40px rgba(0,0,0,0.6)",
          }}
        />
        {isReady && total > 0 && (
          <div className="absolute bottom-2 right-4 text-gray-500 text-xs">
            {current + 1} / {total}
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <div
        className="flex items-center justify-center gap-2 px-3 flex-shrink-0"
        style={{ height: CONTROLS_HEIGHT, background: "rgba(0,0,0,0.7)" }}
      >
        {isReady ? (
          <>
            <button
              onClick={() => goTo(0)}
              disabled={current === 0}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ⏮
            </button>
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ◀
            </button>
            <span className="text-xs text-gray-400 min-w-[60px] text-center">
              {current + 1} / {total}
            </span>
            <button
              onClick={() => goTo(current + 1)}
              disabled={current >= total - 1}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ▶
            </button>
            <button
              onClick={() => goTo(total - 1)}
              disabled={current >= total - 1}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ⏭
            </button>
            <span className="text-gray-600 mx-1">|</span>
            <div className="flex gap-1">
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{
                    background: i === current ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
            <span className="text-gray-600 mx-1">|</span>
            <a
              href={url}
              download={name}
              className="px-2 py-1 text-xs rounded bg-blue-800/30 text-blue-300 hover:bg-blue-800/50"
            >
              ⬇ 下载
            </a>
          </>
        ) : (
          <a
            href={url}
            download={name}
            className="px-2 py-1 text-xs rounded bg-blue-800/30 text-blue-300 hover:bg-blue-800/50"
          >
            ⬇ 下载 PPT
          </a>
        )}
      </div>
    </div>
  );
}
