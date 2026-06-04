import type { ArtifactRow } from "@agenthub/shared";
import { WebPreviewCard } from "../artifact/WebPreviewCard.js";
import { DownloadCard } from "../artifact/DownloadCard.js";
import { TextPreviewCard } from "../artifact/TextPreviewCard.js";
import { ImageSlideshowCard } from "../artifact/ImageSlideshowCard.js";
import { PptxViewerCard } from "../artifact/PptxViewerCard.js";

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
      <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl overflow-hidden">
        <WebPreviewCard previewUrl={url} name={artifact.name} />
      </div>
    );
  }

  // Image preview
  if (isImage(artifact.mimeType)) {
    return (
      <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">🖼️</span>
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{artifact.name}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
          >
            新窗口打开
          </a>
        </div>
        <div className="p-2 flex justify-center bg-white/30 dark:bg-gray-900/30">
          <img
            src={url}
            alt={artifact.name}
            className="max-w-full max-h-64 object-contain rounded"
          />
        </div>
      </div>
    );
  }

  // Slide image slideshow (merged server-side from multiple slide-*.png files)
  if (artifact.type === "slideshow") {
    let imageUrls: string[] = [];
    try {
      const meta = artifact.metadataJson ? JSON.parse(artifact.metadataJson) : null;
      if (meta?.imageUrls?.length > 0) {
        imageUrls = meta.imageUrls;
      }
    } catch { /* ignore parse errors */ }
    if (imageUrls.length > 0) {
      return <ImageSlideshowCard images={imageUrls} name={artifact.name} />;
    }
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

  // PPTX client-side preview (pptxviewjs Canvas-based)
  if (artifact.mimeType?.includes("presentation") || artifact.name.endsWith(".pptx") || artifact.name.endsWith(".ppt")) {
    return (
      <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl overflow-hidden">
        <PptxViewerCard url={url} name={artifact.name} />
      </div>
    );
  }

  // Default: DownloadCard for all other types
  return (
    <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl overflow-hidden">
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
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
      <span>📎</span>
      <span className="truncate flex-1">{artifact.name}</span>
      <span className="text-gray-500 dark:text-gray-600">{formatSize(artifact.size)}</span>
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
