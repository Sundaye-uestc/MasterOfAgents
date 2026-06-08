import { useState } from "react";
import { useEditFileStore } from "../../stores/edit-file.store.js";
import { useUIStore } from "../../stores/ui.store.js";

interface Props {
  previewUrl: string;
  name: string;
}

export function WebPreviewCard({ previewUrl, name }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">🌐</span>
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{name}</span>
        <button
          onClick={() => {
            useEditFileStore.getState().editFile(name);
            useUIStore.getState().openPanel("workspace");
          }}
          className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
          title="在代码编辑器中查看源码"
        >
          查看代码
        </button>
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
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0 font-mono"
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