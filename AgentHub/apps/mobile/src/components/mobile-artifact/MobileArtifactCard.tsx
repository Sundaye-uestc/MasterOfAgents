import { useMobileUIStore } from "../../stores/mobile-ui.store.js";

interface Props {
  artifact: {
    id: string;
    name: string;
    type: string;
    size?: number;
    previewUrl?: string;
    url?: string;
  };
}

const typeIcon: Record<string, string> = {
  webpage: "🌐",
  file: "📄",
  diff: "📊",
  archive: "📦",
  slideshow: "🖼️",
};

export function MobileArtifactCard({ artifact }: Props) {
  const push = useMobileUIStore((s) => s.push);

  const icon = typeIcon[artifact.type] || "📄";
  const sizeStr = artifact.size
    ? artifact.size > 1024 * 1024
      ? `${(artifact.size / 1024 / 1024).toFixed(1)} MB`
      : artifact.size > 1024
        ? `${(artifact.size / 1024).toFixed(1)} KB`
        : `${artifact.size} B`
    : "";

  return (
    <button
      onClick={() => push("artifact", { artifactId: artifact.id, artifact })}
      className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3 active:bg-gray-50 dark:active:bg-gray-800/50 touch-target"
    >
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {artifact.name}
        </div>
        <div className="text-xs text-gray-500">
          {artifact.type} {sizeStr && `· ${sizeStr}`}
        </div>
      </div>
      <span className="text-gray-400 text-sm">→</span>
    </button>
  );
}
