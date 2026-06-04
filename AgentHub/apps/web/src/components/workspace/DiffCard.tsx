import { useState, useEffect } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { DiffBlock } from "../chat/DiffBlock.js";
import { readWorkspaceFile } from "../../lib/api.js";

interface Props {
  change: FileChangeRow;
  workspaceId?: string;
}

const changeColors: Record<string, string> = {
  create: "text-green-600 dark:text-green-400 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20",
  modify: "text-yellow-600 dark:text-yellow-400 border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  delete: "text-red-600 dark:text-red-400 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20",
};

const changeLabels: Record<string, string> = {
  create: "新增",
  modify: "修改",
  delete: "删除",
};

const statusColors: Record<string, string> = {
  pending: "text-gray-400 dark:text-gray-400 bg-gray-200 dark:bg-gray-700",
  applied: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
  reverted: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30",
};

const statusLabels: Record<string, string> = {
  pending: "待处理",
  applied: "已应用",
  reverted: "已回滚",
};

function FileContentViewer({ workspaceId, filePath }: { workspaceId: string; filePath: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readWorkspaceFile(workspaceId, filePath)
      .then((res) => {
        setIsBinary(res.isBinary);
        setContent(res.text);
      })
      .catch(() => setIsBinary(true))
      .finally(() => setLoading(false));
  }, [workspaceId, filePath]);

  if (loading) {
    return <div className="px-3 py-2 text-xs text-gray-600">加载文件内容...</div>;
  }

  if (isBinary || content === null) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500">
        ⚠ 该文件不可查看（二进制文件或不可读）
      </div>
    );
  }

  // Synthesize a unified diff so it renders consistently with DiffBlock
  const syntheticDiff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n${content.split("\n").map((line) => "+" + line).join("\n")}`;

  return (
    <DiffBlock diff={syntheticDiff} filePath={filePath} defaultExpanded={true} />
  );
}

export function DiffCard({ change, workspaceId }: Props) {
  const [expanded, setExpanded] = useState(false);

  // For "create" changes without diff, try to show file content
  const showContent = change.changeType === "create" && !change.diff && workspaceId;

  return (
    <div className={`border rounded-2xl overflow-hidden ${changeColors[change.changeType] ?? "border-gray-200/80 dark:border-gray-700/50"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800/50"
      >
        <span className="text-xs text-gray-400 dark:text-gray-500">{expanded ? "▾" : "▸"}</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${changeColors[change.changeType] ?? ""}`}>
          {changeLabels[change.changeType] ?? change.changeType}
        </span>
        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate flex-1">{change.path}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[change.status] ?? ""}`}>
          {statusLabels[change.status] ?? change.status}
        </span>
      </button>
      {expanded && change.diff && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          <DiffBlock diff={change.diff} filePath={change.path} defaultExpanded={true} />
        </div>
      )}
      {expanded && !change.diff && showContent && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <FileContentViewer workspaceId={workspaceId} filePath={change.path} />
        </div>
      )}
      {expanded && !change.diff && !showContent && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {change.changeType === "delete"
              ? "文件已删除"
              : change.changeType === "create"
              ? "新文件已创建"
              : "文件已修改（无差异数据）"}
          </span>
        </div>
      )}
    </div>
  );
}
