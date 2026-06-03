import type { ArtifactRow } from "@agenthub/shared";
import { WebPreviewCard } from "../artifact/WebPreviewCard.js";
import { DownloadCard } from "../artifact/DownloadCard.js";
import { TextPreviewCard } from "../artifact/TextPreviewCard.js";

interface Props {
  artifact: ArtifactRow;
}

function isImage(mimeType: string | null): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

function isWebpage(artifact: ArtifactRow): boolean {
  return artifact.type === "webpage" || artifact.mimeType === "text/html";
}

function isText(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "text/typescript"
  );
}

function isPresentation(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.includes("presentation") ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  );
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

  // Text file inline preview
  if (isText(artifact.mimeType)) {
    return (
      <TextPreviewCard
        url={url}
        name={artifact.name}
        mimeType={artifact.mimeType}
      />
    );
  }

  // PPT / Presentation file — styled download card
  if (isPresentation(artifact.mimeType)) {
    return (
      <div className="border border-orange-600/40 rounded-lg bg-gradient-to-r from-orange-900/20 to-red-900/10 overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">📊</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-200 truncate">{artifact.name}</div>
            <div className="text-xs text-orange-400/80">PPT 演示文稿</div>
            {artifact.size && (
              <div className="text-xs text-gray-500">{formatSize(artifact.size)}</div>
            )}
          </div>
          <a
            href={url}
            download={artifact.name}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600/30 text-orange-300 hover:bg-orange-600/50 transition-colors"
          >
            ⬇ 下载
          </a>
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
