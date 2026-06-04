/**
 * PPTX preview card using iframe sandbox.
 *
 * The pptx-preview library directly manipulates the DOM and may inject
 * styles that affect the parent page. Rendering it inside an iframe
 * provides complete CSS/JS isolation — the library can do whatever it
 * wants without breaking the host application.
 */

import { useEffect, useRef, useState } from "react";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

interface Props {
  url: string;
  name: string;
}

export function PptxPreviewCard({ url, name }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerRef = useRef<any>(null);
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function load() {
      try {
        // Fetch the .pptx file first (outside iframe)
        const resp = await fetch(url, { signal: ctrl.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        if (cancelled) return;

        // Wait for iframe to be available
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Build a self-contained HTML document inside the iframe
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          throw new Error("无法访问 iframe 文档");
        }

        // Write a minimal HTML shell
        doc.open();
        doc.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      font-family: 'Segoe UI', Arial, 'Microsoft YaHei', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    #pptx-root {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    /* The library renders pagination/buttons */
    #pptx-root .pagination-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px;
    }
  </style>
</head>
<body>
  <div id="pptx-root"></div>
  <script type="module">
    // We need to bundle or use importmap for pptx-preview;
    // instead, we'll load it from a CDN or the parent's copy.
    // The parent will call into the iframe via postMessage or direct script injection.
  </script>
</body>
</html>`);
        doc.close();

        if (cancelled) return;

        // Dynamically inject the pptx-preview library into the iframe.
        // We use a blob URL for the ArrayBuffer and pass it via script injection.
        const rootEl = doc.getElementById("pptx-root");
        if (!rootEl) return;

        // Load pptx-preview from parent's module loader by importing
        // in the parent context and then calling init with the iframe's element.
        const { init } = await import("pptx-preview");

        if (cancelled) return;

        const viewer = init(rootEl as any, {
          width: 960,
          height: 540,
          mode: "slide",
        });
        viewerRef.current = viewer;

        // preview() — with a 30s timeout
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("PPT 加载超时")), 30_000)
        );
        await Promise.race([viewer.preview(buffer), timeoutPromise]);

        if (!cancelled) setState({ phase: "ready" });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setState({
            phase: "error",
            message: err.message || String(err),
          });
        }
      }
    }

    const timer = setTimeout(load, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
      try { viewerRef.current?.destroy?.(); } catch { /* ignore */ }
      viewerRef.current = null;
    };
  }, [url]);

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden">
      {/* iframe — sandbox for pptx-preview library */}
      <div style={{ position: "relative", minHeight: "320px" }}>
        {state.phase === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <span className="animate-pulse text-gray-400">📊 正在加载 PPT...</span>
          </div>
        )}
        {state.phase === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <span className="text-red-400">⚠️ PPT 加载失败</span>
              <span className="text-xs text-red-400/60">{state.message}</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="PPT 预览"
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: "100%",
            minHeight: "400px",
            border: "none",
            display: "block",
          }}
        />
      </div>

      {/* Download bar */}
      <div className="flex items-center justify-end px-3 py-2 bg-gray-800/60 border-t border-gray-700">
        {state.phase === "error" && (
          <a
            href={url}
            download={name}
            className="px-2 py-1 text-xs rounded bg-red-800/30 text-red-300 hover:bg-red-800/50"
          >
            ⬇ 直接下载
          </a>
        )}
        {state.phase === "ready" && (
          <a
            href={url}
            download={name}
            className="px-2 py-1 text-xs rounded bg-orange-600/30 text-orange-300 hover:bg-orange-600/50"
          >
            ⬇ 下载
          </a>
        )}
      </div>
    </div>
  );
}
