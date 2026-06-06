interface Props {
  url?: string;
  name?: string;
}

export function MobileWebPreviewLink({ url, name }: Props) {
  if (!url) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
        <span className="text-3xl">🌐</span>
        <p className="text-sm text-gray-500 mt-2">暂无可预览的网页</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🌐</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {name || "网页预览"}
          </div>
          <div className="text-xs text-gray-500 truncate">{url}</div>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium text-center active:bg-blue-700 touch-target"
      >
        在浏览器中打开
      </a>
    </div>
  );
}
