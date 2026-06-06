import { useRef } from "react";
import { useMobileUIStore } from "../stores/mobile-ui.store.js";
import { useUserAvatar } from "@agenthub/web/hooks/useUserAvatar";

export function SettingsPage() {
  const pop = useMobileUIStore((s) => s.pop);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 pt-safe">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95" style={{ minHeight: "56px" }}>
        <button
          onClick={() => pop()}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 touch-target flex-shrink-0"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">设置</h2>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 pb-safe">
        {/* Profile */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">个人资料</h3>
          <AvatarSetting />
        </div>

        {/* Theme */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">外观</h3>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <ThemeToggleItem />
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">关于</h3>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-700 dark:text-gray-300">版本</span>
              <span className="text-sm text-gray-500">AgentHub Mobile v0.0.0</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">定位</span>
              <span className="text-sm text-gray-500">轻量查看与审批</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvatarSetting() {
  const { avatar, uploadAvatar, clearAvatar } = useUserAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const err = uploadAvatar(dataUrl);
      if (err) alert(err);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      {/* Current avatar */}
      <div className="flex items-center gap-4 px-4 py-4">
        {avatar ? (
          <img
            src={avatar}
            alt="用户头像"
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
          />
        ) : (
          <span className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl border-2 border-gray-300 dark:border-gray-600">
            👤
          </span>
        )}
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">头像</div>
          <div className="text-xs text-gray-500 mt-0.5">点击下方按钮更换</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium active:bg-gray-50 dark:active:bg-gray-800/50 touch-target"
        >
          📷 更换头像
        </button>
        {avatar && (
          <>
            <div className="w-px bg-gray-100 dark:bg-gray-800" />
            <button
              onClick={clearAvatar}
              className="flex-1 py-3 text-sm text-red-500 font-medium active:bg-gray-50 dark:active:bg-gray-800/50 touch-target"
            >
              🗑️ 移除
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

function ThemeToggleItem() {
  const handleToggle = () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
  };

  return (
    <button
      onClick={handleToggle}
      className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800/50 touch-target"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">🌓</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">暗色模式</span>
      </div>
      <span className="text-xs text-gray-400">切换</span>
    </button>
  );
}
