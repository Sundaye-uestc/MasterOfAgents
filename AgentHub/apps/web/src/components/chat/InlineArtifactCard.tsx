import type { ArtifactRow } from "@agenthub/shared";
import { WebPreviewCard } from "../artifact/WebPreviewCard.js";
import { DownloadCard } from "../artifact/DownloadCard.js";

interface Props {
  artifact: ArtifactRow;
}

function isImage(mimeType: string | null): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

function isWebpage(artifact: ArtifactRow): boolean {
  return artifact.type === "webpage" || artifact.mimeType === "text/html";
}

/** Build the static file serving URL for the artifact */
function artifactUrl(artifact: ArtifactRow): string {
  if (artifact.previewUrl) {
    // previewUrl is stored as relative path like "/artifacts/{id}/{filename}"
    return `/api${artifact.previewUrl}`;
  }
  // Fallback: static route pattern
  return `/api/artifacts/static/${artifact.id}/${artifact.name}`;
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InlineArtifactCard({ artifact }: Props) {
  const url = artifactUrl(artifact);

  // Webpage preview
  if (isWebpage(artifact)) {
    return (
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <WebPreviewCard previewUrl={url} name={artifact.name} />
      </div>
    );
  }

  // Image preview
  if (isImage(artifact.mimeType)) {
    return (
      <div className="border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
          <span className="text-xs text-gray-400">🖼️</span>
          <span className="text-xs text-gray-300 truncate flex-1">{artifact.name}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
          >
            新窗口打开
          </a>
        </div>
        <div className="p-2 flex justify-center bg-gray-900/30">
          <img
            src={url}
            alt={artifact.name}
            className="max-w-full max-h-64 object-contain rounded"
          />
        </div>
      </div>
    );
  }

  // Default: DownloadCard for all other types
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <DownloadCard
        name={artifact.name}
        size={artifact.size}
        mimeType={artifact.mimeType}
        downloadUrl={url}
      />
    </div>
  );
}

/** Fallback info line for artifacts without preview */
export function ArtifactInfoLine({ artifact }: { artifact: ArtifactRow }) {
  const url = artifactUrl(artifact);

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400">
      <span>📎</span>
      <span className="truncate flex-1">{artifact.name}</span>
      <span className="text-gray-600">{formatSize(artifact.size)}</span>
      <a
        href={url}
        download={artifact.name}
        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
      >
        下载
      </a>
    </div>
  );
}
