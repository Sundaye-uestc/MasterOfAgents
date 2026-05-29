import { useState, useCallback } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { applyFileChange, revertFileChange } from "../../lib/api.js";
import { DiffCard } from "./DiffCard.js";

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
}

export function WorkspacePanel({ files, snapshots, fileChanges, onFileChangeUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<"files" | "snapshots" | "changes">("files");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

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
          <WorkspaceFileTree files={files} selectedPath={selectedPath} onSelect={setSelectedPath} />
        )}
        {activeTab === "snapshots" && (
          <WorkspaceSnapshotList snapshots={snapshots} selectedId={selectedSnapshotId} onSelect={setSelectedSnapshotId} />
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

// --- Internal sub-components ---

function WorkspaceFileTree({ files, selectedPath, onSelect }: {
  files: FileNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (files.length === 0) {
    return <div className="px-3 py-4 text-xs text-gray-600 text-center">工作区为空</div>;
  }
  return (
    <div className="py-1">
      {sortNodes(files).map((node) => (
        <FileTreeItem key={node.path} node={node} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
}

function WorkspaceSnapshotList({ snapshots, selectedId, onSelect }: {
  snapshots: SnapshotItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (snapshots.length === 0) {
    return <div className="px-3 py-4 text-xs text-gray-600 text-center">暂无快照</div>;
  }
  return (
    <div className="py-1 space-y-0.5">
      {snapshots.map((snap) => {
        const time = new Date(snap.createdAt).toLocaleTimeString();
        const isSelected = selectedId === snap.id;
        return (
          <button
            key={snap.id}
            onClick={() => onSelect(snap.id)}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-800/50 text-xs rounded mx-1 ${
              isSelected ? "bg-blue-600/20 text-blue-300" : "text-gray-400"
            }`}
          >
            <span className="text-gray-500 flex-shrink-0">📸</span>
            <div className="flex-1 min-w-0">
              <div className="text-gray-300 truncate">{snap.label ?? "快照"}</div>
              <div className="text-gray-600 text-[10px]">{time}</div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// --- Helpers ---

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function FileTreeItem({ node, depth, selectedPath, onSelect }: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === "directory") {
    const children = node.children ?? [];
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-2 py-0.5 flex items-center gap-1 hover:bg-gray-800/50 text-xs"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-gray-500 w-3 text-center">{expanded ? "▾" : "▸"}</span>
          <span className="text-yellow-500 flex-shrink-0">📁</span>
          <span className="text-gray-300 truncate">{node.name}</span>
        </button>
        {expanded && sortNodes(children).map((child) => (
          <FileTreeItem key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  const ext = node.name.split(".").pop()?.toLowerCase();
  const fileIcons: Record<string, string> = {
    ts: "🟦", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    json: "📋", css: "🎨", html: "🌐", md: "📝",
    py: "🐍", rs: "🦀", go: "🔵",
  };
  const icon = fileIcons[ext ?? ""] ?? "📄";

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full text-left px-2 py-0.5 flex items-center gap-1 hover:bg-gray-800/50 text-xs ${
        isSelected ? "bg-blue-600/20 text-blue-300" : "text-gray-400"
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-3 flex-shrink-0" />
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}