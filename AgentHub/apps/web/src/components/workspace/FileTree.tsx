import { useState } from "react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** Sort files: directories first, then alphabetical */
function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onSelect: (filePath: string) => void;
  selectedPath: string | null;
}

function FileTreeItem({ node, depth, onSelect, selectedPath }: FileTreeItemProps) {
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
          <FileTreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
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

interface Props {
  files: FileNode[];
  onSelect: (filePath: string) => void;
  selectedPath: string | null;
  emptyMessage?: string;
}

export function FileTree({ files, onSelect, selectedPath, emptyMessage = "工作区为空" }: Props) {
  if (files.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-gray-600 text-center">{emptyMessage}</div>
    );
  }

  return (
    <div className="py-1">
      {sortNodes(files).map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}