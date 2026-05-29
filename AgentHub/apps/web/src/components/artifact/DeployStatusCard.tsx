interface Props {
  status: "pending" | "building" | "deployed" | "failed";
  url: string | null;
  target: string | null;
}

const statusLabels: Record<string, string> = {
  pending: "等待部署",
  building: "构建中",
  deployed: "已部署",
  failed: "部署失败",
};

const statusColors: Record<string, string> = {
  pending: "text-gray-400 bg-gray-700",
  building: "text-yellow-400 bg-yellow-900/30",
  deployed: "text-green-400 bg-green-900/30",
  failed: "text-red-400 bg-red-900/30",
};

const targetLabels: Record<string, string> = {
  "local-static": "本地静态预览",
  zip: "ZIP 下载",
};

export function DeployStatusCard({ status, url, target }: Props) {
  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-base">🚀</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 font-medium">
            {target ? (targetLabels[target] ?? target) : "部署"}
          </div>
          <div className="flex items-center gap-2 text-xs mt-0.5">
            <span className={`px-1.5 py-0.5 rounded ${statusColors[status] ?? ""}`}>
              {statusLabels[status] ?? status}
            </span>
          </div>
        </div>
        {status === "deployed" && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 flex-shrink-0"
          >
            打开
          </a>
        )}
      </div>
    </div>
  );
}