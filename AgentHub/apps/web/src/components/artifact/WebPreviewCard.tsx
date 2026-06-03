import { useState } from "react";

interface Props {
  previewUrl: string;
  name: string;
}

export function WebPreviewCard({ previewUrl, name }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-400">🌐</span>
        <span className="text-xs text-gray-300 truncate">{name}</span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 ml-auto flex-shrink-0"
        >
          新窗口打开
        </a>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0 font-mono"
          title={collapsed ? "展开" : "收起"}
        >
          {collapsed ? "><" : "</>"}
        </button>
      </div>
      {!collapsed && (
        <div className="bg-white">
          <iframe
            src={previewUrl}
            className="w-full h-96 border-0"
            title={name}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}