/**
 * Client-side PPTX viewer card.
 *
 * Fetches the .pptx binary from the artifact static URL, parses it
 * with JSZip + DOMParser (no server dependency), and renders slides
 * as positioned HTML elements with navigation controls.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PptxSlide, PptxShape } from "../../lib/pptx-parser.js";
import { parsePptx } from "../../lib/pptx-parser.js";

// ---------------------------------------------------------------------------
// Alignment helpers
// ---------------------------------------------------------------------------

function alignToFlex(align?: string): string {
  switch (align) {
    case "ctr": return "center";
    case "r": return "flex-end";
    default: return "flex-start";
  }
}

// ---------------------------------------------------------------------------
// Shape renderer
// ---------------------------------------------------------------------------

function SlideShape({ shape, scaleX, scaleY }: { shape: PptxShape; scaleX: number; scaleY: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: shape.left * scaleX,
    top: shape.top * scaleY,
    width: shape.width * scaleX,
    height: shape.height * scaleY,
    overflow: "hidden",
    boxSizing: "border-box",
    padding: "2px 6px",
  };

  if (shape.type === "image" && shape.imageDataUrl) {
    return (
      <div style={style}>
        <img
          src={shape.imageDataUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }

  if (shape.type === "table" && shape.tableRows) {
    return (
      <div style={style}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.65em",
          color: "#222",
        }}>
          <tbody>
            {shape.tableRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: "1px solid #ccc",
                      padding: "2px 4px",
                      background: ri === 0 ? "#e8ecf1" : "#fff",
                      fontWeight: ri === 0 ? 600 : 400,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (shape.type === "text" && shape.paragraphs) {
    return (
      <div style={style}>
        {shape.paragraphs.map((p, pi) => (
          <p
            key={pi}
            style={{
              margin: "0 0 2px 0",
              lineHeight: 1.3,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: alignToFlex(p.alignment),
            }}
          >
            {p.runs.map((run, ri) => (
              <span
                key={ri}
                style={{
                  fontWeight: run.bold ? 700 : 400,
                  fontStyle: run.italic ? "italic" : "normal",
                  fontSize: run.fontSize ? `${run.fontSize * 0.85}pt` : "0.75em",
                  color: run.color || "#333",
                }}
              >
                {run.text}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main viewer
// ---------------------------------------------------------------------------

interface Props {
  url: string;
  name: string;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; slides: PptxSlide[] };

export function PptxViewerCard({ url, name }: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [current, setCurrent] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function load() {
      setState({ phase: "loading" });
      try {
        const resp = await fetch(url, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        if (cancelled) return;
        const slides = await parsePptx(buffer);
        if (!cancelled) setState({ phase: "ready", slides });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setState({ phase: "error", message: err.message || String(err) });
        }
      }
    }

    load();
    return () => { cancelled = true; ctrl.abort(); };
  }, [url]);

  // Slide dimensions: scale to fit a 960px wide container
  const { scaledSlides, slideWidth, slideHeight } = useMemo(() => {
    if (state.phase !== "ready") return { scaledSlides: [], slideWidth: 0, slideHeight: 0 };

    const slides = state.slides;
    if (slides.length === 0) return { scaledSlides: [], slideWidth: 0, slideHeight: 0 };

    const targetW = 960;
    // Find largest slide for consistent scaling
    let maxW = 0;
    let maxH = 0;
    for (const s of slides) {
      if (s.widthPx > maxW) maxW = s.widthPx;
      if (s.heightPx > maxH) maxH = s.heightPx;
    }
    // Use the first slide's aspect ratio as reference
    const ref = slides[0]!;
    const scaleX = targetW / ref.widthPx;
    const slideWidth = targetW;
    const slideHeight = ref.heightPx * scaleX;

    const scaledSlides = slides.map((s) => ({
      shapes: s.shapes,
      slideNum: s.index + 1,
    }));

    return { scaledSlides, slideWidth, slideHeight };
  }, [state]);

  const total = scaledSlides.length;

  const goTo = (n: number) => {
    setCurrent(Math.max(0, Math.min(total - 1, n)));
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goTo(current + 1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goTo(current - 1); }
      if (e.key === "Home") { e.preventDefault(); goTo(0); }
      if (e.key === "End") { e.preventDefault(); goTo(total - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, total]);

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

  // Click edges
  const handleClick = (e: React.MouseEvent) => {
    if (!viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < rect.width * 0.2) goTo(current - 1);
    else if (relX > rect.width * 0.8) goTo(current + 1);
  };

  // --- Loading state ---
  if (state.phase === "loading") {
    return (
      <div className="border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden">
        <div className="flex items-center justify-center py-16 text-gray-400">
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
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-xl">📊</span>
          <span className="text-sm text-gray-300 truncate flex-1">{name}</span>
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
    <div className="border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden">
      {/* Viewport */}
      <div
        ref={viewerRef}
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
          cursor: "pointer",
          minHeight: "200px",
        }}
      >
        {scaledSlides.map((s, i) => (
          <div
            key={i}
            style={{
              display: i === current ? "block" : "none",
              position: "relative",
              width: slideWidth,
              height: slideHeight || "auto",
              background: "#fff",
              boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
              margin: "0 auto",
              fontFamily: "'Segoe UI', Arial, 'Microsoft YaHei', sans-serif",
              borderRadius: "2px",
              animation: "pptxFadeIn 0.3s ease",
            }}
          >
            {s.shapes.map((shape, j) => (
              <SlideShape key={j} shape={shape} scaleX={scaleX} scaleY={scaleY} />
            ))}
          </div>
        ))}
        {/* Fade-in keyframes injected via style tag */}
        <style>{`@keyframes pptxFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Slide number */}
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
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800/60 border-t border-gray-700">
        <button
          onClick={() => goTo(0)}
          disabled={current === 0}
          className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
        >
          ◀
        </button>
        <span className="text-xs text-gray-400 min-w-[60px] text-center">
          {current + 1} / {total}
        </span>
        <button
          onClick={() => goTo(current + 1)}
          disabled={current >= total - 1}
          className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
        >
          ▶
        </button>
        <button
          onClick={() => goTo(total - 1)}
          disabled={current >= total - 1}
          className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 disabled:opacity-30"
        >
          ⏭
        </button>
        <span className="text-gray-600 mx-1">|</span>
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
        <span className="text-gray-600 mx-1">|</span>
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
