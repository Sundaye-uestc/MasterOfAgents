import { useState, useEffect, useCallback } from "react";
import type { ArtifactRow } from "@agenthub/shared";
import { useMobileUIStore } from "../stores/mobile-ui.store.js";
import { getArtifact, readWorkspaceFile } from "@agenthub/web/lib/api";
import { useWorkspaceStore } from "@agenthub/web/stores/workspace.store";
import { MobileWebPreviewLink } from "../components/mobile-artifact/MobileWebPreviewLink.jsx";
import { MobileFileViewer } from "../components/mobile-artifact/MobileFileViewer.jsx";
import { MobileDeployStatus } from "../components/mobile-artifact/MobileDeployStatus.jsx";
import { MobileDiffSummary } from "../components/mobile-artifact/MobileDiffSummary.jsx";

export function ArtifactPreviewPage() {
  const stack = useMobileUIStore((s) => s.stack);
  const pop = useMobileUIStore((s) => s.pop);
  const entry = stack[stack.length - 1];
  const params = (entry?.params || {}) as Record<string, unknown>;

  const workspaceId = useWorkspaceStore((s) => s.workspaceId);

  const [artifact, setArtifact] = useState<any>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const artifactId = params.artifactId as string;
    const artifactObj = params.artifact as any;

    if (artifactObj) {
      setArtifact(artifactObj);
      setLoading(false);
    } else if (artifactId) {
      getArtifact(artifactId)
        .then((a) => {
          setArtifact(a);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (params.filePath && workspaceId) {
      readWorkspaceFile(workspaceId, params.filePath as string)
        .then((data) => {
          setFileContent(typeof data === "string" ? data : JSON.stringify(data));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [params.artifactId, params.artifact, params.filePath, workspaceId]);

  const isWebPreview = artifact?.type === "webpage";
  const isDiff = artifact?.type === "diff";
  const isFile = !!params.filePath || artifact?.type === "file";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 pt-safe">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95" style={{ minHeight: "56px" }}>
        <button
          onClick={() => pop()}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 touch-target flex-shrink-0"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex-1">
          {artifact?.name || (params.filePath as string)?.split("/").pop() || "预览"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-safe">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
        ) : isWebPreview && artifact ? (
          <div className="px-4 py-4 space-y-3">
            <MobileWebPreviewLink url={artifact.previewUrl || artifact.url} name={artifact.name} />
          </div>
        ) : isDiff && (artifact?.diff || artifact?.diffText) ? (
          <div className="px-4 py-4">
            <MobileDiffSummary diffText={artifact.diff || artifact.diffText || ""} />
          </div>
        ) : isFile && fileContent ? (
          <MobileFileViewer content={fileContent} fileName={(params.filePath as string) || artifact?.name || ""} />
        ) : artifact ? (
          <div className="px-4 py-4 space-y-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{artifact.name}</div>
              <div className="text-xs text-gray-500 mt-1">类型: {artifact.type}</div>
              <div className="text-xs text-gray-500">大小: {artifact.size || "未知"}</div>
            </div>
            <MobileDeployStatus artifactId={artifact.id} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            无法预览此文件
          </div>
        )}
      </div>
    </div>
  );
}
