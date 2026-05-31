import { useState, useCallback } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { applyFileChange, revertFileChange } from "../../lib/api.js";
import { DiffCard } from "./DiffCard.js";
import { FileTree } from "./FileTree.js";
import { SnapshotList } from "./SnapshotList.js";

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

  return (
    <div className="border-l border-gray-700 bg-gray-900 flex flex-col" style={{ width: "320px", maxHeight: "100vh" }}>
      {/* Header */}
      <div className="border-b border-gray-800 px-3 py-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">工作区</h3>
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
          <div className="divide-y divide-gray-800/50">
            {fileChanges.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-600 text-center">暂无变更</div>
            )}
            {fileChanges.map((change) => (
              <div key={change.id} className="bg-gray-900/50">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
