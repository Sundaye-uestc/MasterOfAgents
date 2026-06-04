import type { ArtifactRow } from "@agenthub/shared";

interface Props {
  artifact: ArtifactRow;
}

const typeIcons: Record<string, string> = {
  file: "📄",
  diff: "📊",
  webpage: "🌐",
  archive: "📦",
};

const typeLabels: Record<string, string> = {
  file: "文件",
  diff: "差异",
  webpage: "网页",
  archive: "归档",
};

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactCard({ artifact }: Props) {
  const icon = typeIcons[artifact.type] ?? "📄";
  const label = typeLabels[artifact.type] ?? artifact.type;

  return (
    <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl bg-gray-100 dark:bg-gray-800/40 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium">{artifact.name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            <span>{label}</span>
            {artifact.size !== null && artifact.size !== undefined && (
              <span>{formatSize(artifact.size)}</span>
            )}
          </div>
        </div>
        {artifact.previewUrl && (
          <a
            href={artifact.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 flex-shrink-0"
          >
            预览
          </a>
        )}
      </div>
    </div>
  );
}