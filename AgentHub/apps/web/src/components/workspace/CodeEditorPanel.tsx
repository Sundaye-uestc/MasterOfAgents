// ============================================================
// CodeEditorPanel — Monaco Editor with file tabs
// ============================================================

import { useState, useCallback, useEffect, lazy, Suspense, useRef } from "react";
import { readWorkspaceFile, writeWorkspaceFile } from "../../lib/api.js";

const Editor = lazy(() => import("@monaco-editor/react"));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

interface Props {
  workspaceId: string;
  openFilePath?: string | null;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  json: "json", css: "css", html: "html", htm: "html",
  md: "markdown", py: "python", rs: "rust", go: "go",
  java: "java", c: "c", cpp: "cpp", h: "c",
  sh: "shell", rb: "ruby", php: "php",
  swift: "swift", kt: "kotlin", sql: "sql", xml: "xml",
  yaml: "yaml", yml: "yaml", toml: "toml", lua: "lua",
};

function getLang(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return LANG_MAP[ext] ?? "plaintext";
}

// ---------------------------------------------------------------------------
// CodeEditorPanel
// ---------------------------------------------------------------------------

export function CodeEditorPanel({ workspaceId, openFilePath }: Props) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  // Track pending file path to avoid double-opens
  const lastOpenedRef = useRef<string | null>(null);

  const doOpenFile = useCallback(async (filePath: string) => {
    if (lastOpenedRef.current === filePath) return; // dedup
    lastOpenedRef.current = filePath;

    setOpenFiles((prev) => {
      const existing = prev.find((f) => f.path === filePath);
      if (existing) {
        setActivePath(filePath);
        return prev;
      }
      return prev;
    });

    // If file is already open, just switch to it
    setOpenFiles((prev) => {
      const existing = prev.find((f) => f.path === filePath);
      if (existing) {
        setActivePath(filePath);
        return prev;
      }
      return prev; // not in state yet, will add after fetch
    });

    // Check again with fresh state to avoid race
    let alreadyOpen = false;
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === filePath)) alreadyOpen = true;
      return prev;
    });
    if (alreadyOpen) return;

    setLoading(true);
    try {
      const result = await readWorkspaceFile(workspaceId, filePath);
      if (result.notFound) {
        setToast("文件已不存在");
        setTimeout(() => setToast(""), 2000);
        return;
      }
      if (result.isBinary || result.text === null) {
        setToast("无法打开二进制文件");
        setTimeout(() => setToast(""), 2000);
        return;
      }
      const name = filePath.split("/").pop() || filePath;
      setOpenFiles((prev) => {
        // Final check — don't add if already present
        if (prev.some((f) => f.path === filePath)) return prev;
        return [...prev, { path: filePath, name, content: result.text ?? "", dirty: false }];
      });
      setActivePath(filePath);
    } catch {
      setToast("读取文件失败");
      setTimeout(() => setToast(""), 2000);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Handle openFilePath prop
  useEffect(() => {
    if (openFilePath) doOpenFile(openFilePath);
  }, [openFilePath, doOpenFile]);

  const activeFile = openFiles.find((f) => f.path === activePath);

  const closeFile = useCallback((filePath: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== filePath);
      if (activePath === filePath && next.length > 0) {
        const idx = prev.findIndex((f) => f.path === filePath);
        const newActive = next[Math.min(idx, next.length - 1)];
        if (newActive) setActivePath(newActive.path);
      } else if (next.length === 0) {
        setActivePath(null);
      }
      return next;
    });
  }, [activePath]);

  const handleChange = useCallback((value: string | undefined) => {
    if (!activePath || value === undefined) return;
    setOpenFiles((prev) => prev.map((f) =>
      f.path === activePath ? { ...f, content: value, dirty: true } : f
    ));
  }, [activePath]);

  const handleSave = useCallback(async () => {
    if (!activeFile?.dirty) return;
    try {
      await writeWorkspaceFile(workspaceId, activeFile.path, activeFile.content);
      setOpenFiles((prev) => prev.map((f) =>
        f.path === activeFile.path ? { ...f, dirty: false } : f
      ));
      setToast("已保存");
      setTimeout(() => setToast(""), 1500);
    } catch {
      setToast("保存失败");
      setTimeout(() => setToast(""), 2000);
    }
  }, [workspaceId, activeFile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Tabs */}
      {openFiles.length > 0 && (
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700/50 overflow-x-auto flex-shrink-0 bg-gray-100/50 dark:bg-gray-800/30">
          {openFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => setActivePath(file.path)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs border-r border-gray-200 dark:border-gray-700/50 whitespace-nowrap ${
                activePath === file.path
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <span className="truncate max-w-[100px]">{file.name}</span>
              {file.dirty && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
              <span onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none">✕</span>
            </button>
          ))}
          {activeFile?.dirty && (
            <button onClick={handleSave}
              className="ml-auto px-3 py-1.5 text-xs text-white bg-blue-500 hover:bg-blue-600 flex-shrink-0">
              保存
            </button>
          )}
        </div>
      )}

      {/* Editor */}
      {activeFile ? (
        <div className="flex-1">
          <Suspense fallback={<div className="p-4 text-xs text-gray-400">加载编辑器...</div>}>
            <Editor
              height="100%"
              language={getLang(activeFile.path)}
              value={activeFile.content}
              onChange={handleChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          </Suspense>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
          {loading ? "加载中..." : "点击工作区文件开始编辑"}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-gray-800/90 text-white text-xs shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
