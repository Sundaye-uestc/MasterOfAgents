import { useState, useCallback, useEffect, useRef } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { applyFileChange, revertFileChange } from "../../lib/api.js";
import { DiffCard } from "./DiffCard.js";
import { FileTree } from "./FileTree.js";
import { SnapshotList } from "./SnapshotList.js";
import { useUIStore } from "../../stores/ui.store.js";
import { useWorkspaceStore } from "../../stores/workspace.store.js";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface SnapshotItem {
  id: string;
  label: string | null;
  createdAt: string;
  runId: string | null;
}

interface Props {
  files: FileNode[];
  snapshots: SnapshotItem[];
  fileChanges: FileChangeRow[];
  onFileChangeUpdate: (updated: FileChangeRow) => void;
  onTogglePanel?: () => void;
  onFileSelect?: (filePath: string) => void;
}

export function WorkspacePanel({
  files,
  snapshots,
  fileChanges,
  onFileChangeUpdate,
  onTogglePanel,
  onFileSelect,
}: Props) {
  const [activeTab, setActiveTab] = useState<"files" | "snapshots" | "changes">("files");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showDirInput, setShowDirInput] = useState(false);
  const [dirInput, setDirInput] = useState("");
  const changesRef = useRef<HTMLDivElement>(null);

  // Workspace store for current directory
  const workspaceRootPath = useWorkspaceStore((s) => s.rootPath);
  const workspaceUpdateRootPath = useWorkspaceStore((s) => s.updateRootPath);

  // Cross-component linking: respond to selectedChangePath from ui.store
  const selectedChangePath = useUIStore((s) => s.selectedChangePath);
  const selectChangePath = useUIStore((s) => s.selectChangePath);

  useEffect(() => {
    if (selectedChangePath) {
      setActiveTab("changes");
      // Clear selection after handling
      const timer = setTimeout(() => selectChangePath(null), 100);
      return () => clearTimeout(timer);
    }
  }, [selectedChangePath, selectChangePath]);

  const handleFileSelect = useCallback((path: string) => {
    setSelectedPath(path);
    onFileSelect?.(path);
  }, [onFileSelect]);

  const handleApply = useCallback(async (id: string) => {
    setActingId(id);
    try {
      const updated = await applyFileChange(id);
      onFileChangeUpdate(updated);
    } catch (err) {
      console.error("Failed to apply file change", err);
    } finally {
      setActingId(null);
    }
  }, [onFileChangeUpdate]);

  const handleRevert = useCallback(async (id: string) => {
    setActingId(id);
    try {
      const updated = await revertFileChange(id);
      onFileChangeUpdate(updated);
    } catch (err) {
      console.error("Failed to revert file change", err);
    } finally {
      setActingId(null);
    }
  }, [onFileChangeUpdate]);

  const pendingChanges = fileChanges.filter((c) => c.status === "pending");

  const handleChangeDir = useCallback(() => {
    setDirInput(workspaceRootPath ?? "");
    setShowDirInput(true);
  }, [workspaceRootPath]);

  const handleConfirmDir = useCallback(async () => {
    const path = dirInput.trim();
    if (path) {
      await workspaceUpdateRootPath(path);
    }
    setShowDirInput(false);
  }, [dirInput, workspaceUpdateRootPath]);

  return (
    <div className="border-l border-gray-700 bg-gray-900 flex flex-col" style={{ width: "320px", maxHeight: "100vh" }}>
      {/* Header */}
      <div className="border-b border-gray-800 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">工作区</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleChangeDir}
              className="text-gray-500 hover:text-blue-400 text-[10px] px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors"
              title="更改工作目录"
            >
              📂 更改工作目录
            </button>
            {onTogglePanel && (
              <button
                onClick={onTogglePanel}
                className="text-gray-500 hover:text-gray-300 text-xs px-1"
                title="关闭工作区"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {workspaceRootPath && (
          <p className="text-[10px] text-gray-600 mt-1 truncate" title={workspaceRootPath}>
            {workspaceRootPath}
          </p>
        )}
      </div>

      {/* Directory change input */}
      {showDirInput && (
        <div className="border-b border-gray-800 px-3 py-2 bg-gray-800/50">
          <input
            type="text"
            value={dirInput}
            onChange={(e) => setDirInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDir(); if (e.key === "Escape") setShowDirInput(false); }}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-blue-500"
            placeholder="D:\Projects\..."
            autoFocus
          />
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={handleConfirmDir}
              className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 flex-1"
            >
              确认
            </button>
            <button
              onClick={() => setShowDirInput(false)}
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 flex-1"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["files", "snapshots", "changes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs py-1.5 ${
              activeTab === tab
                ? "text-blue-400 border-b border-blue-400 bg-blue-400/5"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "files" ? "文件" : tab === "snapshots" ? "快照" : "变更"}
            {tab === "changes" && pendingChanges.length > 0 && (
              <span className="ml-1 text-yellow-400">({pendingChanges.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "files" && (
          <FileTree
            files={files}
            selectedPath={selectedPath}
            onSelect={handleFileSelect}
          />
        )}
        {activeTab === "snapshots" && (
          <SnapshotList
            snapshots={snapshots}
            selectedId={selectedSnapshotId}
            onSelect={setSelectedSnapshotId}
          />
        )}
        {activeTab === "changes" && (
          <div className="divide-y divide-gray-800/50" ref={changesRef}>
            {fileChanges.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-600 text-center">暂无变更</div>
            )}
            {fileChanges.map((change) => {
              const isHighlighted = selectedChangePath === change.path;
              return (
              <div key={change.id} className={`${isHighlighted ? "ring-1 ring-blue-500 bg-blue-900/10" : "bg-gray-900/50"}`}>
                <DiffCard change={change} />
                {change.status === "pending" && (
                  <div className="flex gap-2 px-3 py-1.5">
                    <button
                      onClick={() => handleApply(change.id)}
                      disabled={actingId === change.id}
                      className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 disabled:opacity-50 flex-1"
                    >
                      {actingId === change.id ? "处理中..." : "应用"}
                    </button>
                    <button
                      onClick={() => handleRevert(change.id)}
                      disabled={actingId === change.id}
                      className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50 flex-1"
                    >
                      {actingId === change.id ? "处理中..." : "回滚"}
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
