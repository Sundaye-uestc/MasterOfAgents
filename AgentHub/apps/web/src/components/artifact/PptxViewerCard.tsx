/**
 * Client-side PPTX viewer card using pptxviewjs (Canvas-based rendering).
 *
 * Fetches the .pptx binary from the artifact static URL, renders each
 * slide to a <canvas> via the pptxviewjs library, and provides the
 * same navigation UI as ImageSlideshowCard (keyboard, touch, click edges,
 * dot indicators, prev/next/home/end buttons).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PPTXViewer as IPPTXViewer } from "pptxviewjs";

interface Props {
  url: string;
  name: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

/** Extract slide dimensions in EMU from the processor (internal API).
 *  The processor returns `{ cx, cy }` in EMU directly. */
function getSlideEmu(viewer: IPPTXViewer): { cx: number; cy: number } | null {
  try {
    const proc = (viewer as any).processor;
    if (!proc?.getSlideDimensions) return null;
    const dims = proc.getSlideDimensions();
    if (dims) {
      // Processor returns { cx, cy } in EMU
      if (typeof dims.cx === "number" && typeof dims.cy === "number") {
        return { cx: dims.cx, cy: dims.cy };
      }
      // Fallback: some sub-classes return { width, height } in mm
      if (typeof dims.width === "number" && typeof dims.height === "number") {
        return {
          cx: Math.round(dims.width * 36000),
          cy: Math.round(dims.height * 36000),
        };
      }
    }
  } catch {
    /* internal API — degrade gracefully */
  }
  return null;
}

export function PptxViewerCard({ url, name }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<IPPTXViewer | null>(null);
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 540 });
  const [slideRatio, setSlideRatio] = useState(9 / 16); // default 16:9
  const slideRatioRef = useRef(slideRatio);
  slideRatioRef.current = slideRatio;
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;
  const touchStartX = useRef(0);
  const loadedRef = useRef(false);

  // ResizeObserver — keep canvas internal resolution matched to the
  // viewport width, height follows the actual slide aspect ratio.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = entry.contentRect.width;
        const w = Math.max(400, Math.floor(cw - 40)); // 20 px padding each side
        const h = Math.round(w * slideRatioRef.current);
        setCanvasSize((prev) =>
          prev.w === w && prev.h === h ? prev : { w, h },
        );
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-render current slide after canvas size or ratio changes
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

        // Set explicit canvas dimensions before handing to the viewer.
        // Default is 300×150 which produces a tiny, blurry render.
        const { w, h } = canvasSizeRef.current;
        canvas.width = w;
        canvas.height = h;

        const viewer = new Viewer({
          canvas,
          slideSizeMode: "fit",
          backgroundColor: "#1a1a2e",
        });
        viewerRef.current = viewer;

        // Fetch and load the PPTX file
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        if (cancelled) return;

        await viewer.loadFile(buffer);
        if (cancelled) return;

        // Extract the actual slide aspect ratio so canvas height matches.
        // Default EMU: 16:9 = 12192000×6858000, 4:3 = 9144000×6858000
        const emu = getSlideEmu(viewer);
        if (emu) {
          const ratio = emu.cy / emu.cx; // e.g. 0.5625 for 16:9, 0.75 for 4:3
          setSlideRatio(ratio);
          // Correct canvas height immediately to avoid a flash of wrong ratio
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
          const message =
            err instanceof Error ? err.message : String(err);
          setState({ phase: "error", message });
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
        /* ignore transient render errors during navigation */
      }
    },
    [total],
  );

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goTo(current + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, total, goTo]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches.item(0);
    if (t) touchStartX.current = t.clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches.item(0);
    if (!t) return;
    const dx = t.clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      dx < 0 ? goTo(current + 1) : goTo(current - 1);
    }
  };

  // Click edges (20% zones) for prev/next
  const handleClick = (e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < rect.width * 0.2) goTo(current - 1);
    else if (relX > rect.width * 0.8) goTo(current + 1);
  };

  // --- Loading state ---
  if (state.phase === "loading") {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <span className="animate-pulse">📊 正在解析 PPT...</span>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (state.phase === "error") {
    return (
      <div className="border border-red-800/40 rounded-lg bg-red-900/20 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-red-400">⚠️ PPT 解析失败</span>
          <span className="text-xs text-red-400/60">{state.message}</span>
          <a
            href={url}
            download={name}
            className="mt-2 px-3 py-1 text-xs rounded bg-red-800/30 text-red-300 hover:bg-red-800/50"
          >
            ⬇ 直接下载
          </a>
        </div>
      </div>
    );
  }

  // --- Empty ---
  if (total === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-xl">📊</span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{name}</span>
          <a
            href={url}
            download={name}
            className="px-3 py-1 text-xs rounded bg-orange-600/30 text-orange-300 hover:bg-orange-600/50"
          >
            ⬇ 下载
          </a>
        </div>
      </div>
    );
  }

  // --- Ready ---
  const refSlide = state.phase === "ready" ? state.slides[0] : null;
  const scaleX = refSlide ? slideWidth / refSlide.widthPx : 1;
  const scaleY = refSlide ? slideHeight / refSlide.heightPx : 1;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-gray-900/50 overflow-hidden">
      {/* Viewport */}
      <div
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          overflow: "hidden",
          cursor: isReady ? "pointer" : "default",
          minHeight: "320px",
        }}
      >
        {/* Loading overlay */}
        {state.phase === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <span className="animate-pulse text-gray-400">
              📊 正在加载 PPT...
            </span>
          </div>
        )}

        {/* Error overlay */}
        {state.phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10 gap-2">
            <span className="text-red-400">⚠️ PPT 加载失败</span>
            <span className="text-xs text-red-400/60">{state.message}</span>
          </div>
        )}

        {/* Canvas — both attributes AND CSS dimensions set explicitly.
            calculateCanvasRect reads CSS style values; if height is
            missing it falls back to canvas.height / devicePixelRatio,
            which halves the logical size on HiDPI screens. Setting
            both avoids that path entirely. Responsiveness is handled
            by the ResizeObserver, which recomputes canvasSize. */}
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{
            width: `${canvasSize.w}px`,
            height: `${canvasSize.h}px`,
            boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
            borderRadius: "2px",
          }}
        />

        {/* Slide number indicator (bottom-right) */}
        {isReady && total > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              right: "24px",
              color: "#666",
              fontSize: "10px",
            }}
          >
            {current + 1} / {total}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => goTo(0)}
          disabled={current === 0}
          className="px-2 py-1 text-xs rounded bg-gray-200/80 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="px-2 py-1 text-xs rounded bg-gray-200/80 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          ◀
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
          {current + 1} / {total}
        </span>
        <button
          onClick={() => goTo(current + 1)}
          disabled={current >= total - 1}
          className="px-2 py-1 text-xs rounded bg-gray-200/80 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          ▶
        </button>
        <button
          onClick={() => goTo(total - 1)}
          disabled={current >= total - 1}
          className="px-2 py-1 text-xs rounded bg-gray-200/80 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          ⏭
        </button>
        <span className="text-gray-500 dark:text-gray-600 mx-1">|</span>
        {/* Dots */}
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
        <span className="text-gray-500 dark:text-gray-600 mx-1">|</span>
        <a
          href={url}
          download={name}
          className="px-2 py-1 text-xs rounded bg-orange-600/30 text-orange-300 hover:bg-orange-600/50"
        >
          ⬇ 下载
        </a>
      </div>
    </div>
  );
}
