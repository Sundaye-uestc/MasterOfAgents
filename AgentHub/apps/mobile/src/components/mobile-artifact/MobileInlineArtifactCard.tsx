import type { ArtifactRow } from "@agenthub/shared";
import { WebPreviewCard } from "@agenthub/web/components/artifact/WebPreviewCard";
import { TextPreviewCard } from "@agenthub/web/components/artifact/TextPreviewCard";
import { PptxViewerCard } from "@agenthub/web/components/artifact/PptxViewerCard";
import { DownloadCard } from "@agenthub/web/components/artifact/DownloadCard";

interface Props {
  artifact: ArtifactRow;
}

function isWebpage(artifact: ArtifactRow): boolean {
  return artifact.type === "webpage" || artifact.mimeType === "text/html";
}

function isText(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript"
  );
}

/** Build the static file serving URL for the artifact */
function artifactUrl(artifact: ArtifactRow): string {
  if (artifact.previewUrl) {
    return `/api${artifact.previewUrl}`;
  }
  return `/api/artifacts/static/${artifact.id}/${artifact.name}`;
}

/**
 * Mobile inline artifact card — rendered below agent messages inside the chat.
 * Routes to different preview components based on artifact type/mimeType.
 * Images are intentionally skipped per current requirements.
 */
export function MobileInlineArtifactCard({ artifact }: Props) {
  const url = artifactUrl(artifact);

  // Webpage / HTML — inline iframe preview (same as web)
  if (isWebpage(artifact)) {
    return (
      <div className="mt-1">
        <WebPreviewCard previewUrl={url} name={artifact.name} />
      </div>
    );
  }

  // Text / code files — fetch + syntax-aware preview with collapse
  if (isText(artifact.mimeType)) {
    return (
      <div className="mt-1">
        <TextPreviewCard
          url={url}
          name={artifact.name}
          mimeType={artifact.mimeType}
          maxLines={120}
          maxChars={40000}
        />
      </div>
    );
  }

  // PPTX — Canvas-based slide viewer (same as web, supports touch swipe)
  if (artifact.mimeType?.includes("presentation") || artifact.name.endsWith(".pptx")) {
    return (
      <div className="mt-1 overflow-hidden rounded-lg">
        <PptxViewerCard url={url} name={artifact.name} />
      </div>
    );
  }

  // Default: DownloadCard for all other file types
  return (
    <div className="mt-1">
      <DownloadCard
        name={artifact.name}
        size={artifact.size}
        mimeType={artifact.mimeType}
        downloadUrl={url}
      />
    </div>
  );
}
