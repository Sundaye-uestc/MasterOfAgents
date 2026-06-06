import { useState, useCallback } from "react";
import { useArtifactStore } from "@agenthub/web/stores/artifact.store";
import { deployArtifact } from "@agenthub/web/lib/api";

interface Props {
  artifactId: string;
}

const statusBadge: Record<string, { icon: string; label: string; color: string }> = {
  pending: { icon: "⏳", label: "待部署", color: "text-gray-500" },
  building: { icon: "🔄", label: "构建中", color: "text-blue-500" },
  deployed: { icon: "✅", label: "已部署", color: "text-green-500" },
  failed: { icon: "❌", label: "部署失败", color: "text-red-500" },
};

export function MobileDeployStatus({ artifactId }: Props) {
  const deployments = useArtifactStore((s) => s.deployments);
  const [deploying, setDeploying] = useState(false);

  const dep = deployments.find((d) => d.artifactId === artifactId);
  const badge = dep ? statusBadge[dep.status] || statusBadge.pending : null;

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    try {
      await deployArtifact(artifactId);
    } catch { /* ignore */ }
    setDeploying(false);
  }, [artifactId]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">部署</span>
        {badge && (
          <span className={`text-xs ${badge.color}`}>
            {badge.icon} {badge.label}
          </span>
        )}
      </div>

      {dep?.status === "deployed" && dep.url && (
        <div className="text-xs text-gray-500 truncate">
          预览: <span className="text-blue-600 dark:text-blue-400">{dep.url}</span>
        </div>
      )}

      {(!dep || dep.status === "failed") && (
        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 disabled:opacity-50 touch-target"
        >
          {deploying ? "部署中..." : "部署"}
        </button>
      )}
    </div>
  );
}
