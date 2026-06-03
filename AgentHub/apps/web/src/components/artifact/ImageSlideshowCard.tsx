/**
 * Image slideshow card — displays an array of slide images with
 * keyboard/touch/click navigation, dot indicators, and fade animation.
 *
 * Reuses the same UI patterns as the former PptxViewerCard but works
 * with pre-generated PNG images instead of parsing PPTX.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  images: string[];
  name: string;
}

export function ImageSlideshowCard({ images, name }: Props) {
  const [current, setCurrent] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const total = images.length;

  const goTo = (n: number) => {
    setCurrent(Math.max(0, Math.min(total - 1, n)));
  };

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

  if (total === 0) return null;

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
        {/* Inline keyframes */}
        <style>{`@keyframes pptxFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Slide ${i + 1}`}
            style={{
              display: i === current ? "block" : "none",
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
              boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
              borderRadius: "2px",
              animation: "pptxFadeIn 0.3s ease",
            }}
          />
        ))}

        {/* Slide number indicator */}
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

      {/* Controls bar */}
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
        {/* Dot indicators */}
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                background:
                  i === current
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
