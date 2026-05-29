interface Props {
  name: string;
  size: number | null;
  mimeType: string | null;
  downloadUrl: string;
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadCard({ name, size, mimeType, downloadUrl }: Props) {
  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-base">📦</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200 truncate font-medium">{name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{formatSize(size)}</span>
            {mimeType && <span>{mimeType}</span>}
          </div>
        </div>
        <a
          href={downloadUrl}
          download={name}
          className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 flex-shrink-0"
        >
          ⬇ 下载
        </a>
      </div>
    </div>
  );
}