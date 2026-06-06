import { useCallback } from "react";
import { useMobileUIStore } from "../stores/mobile-ui.store.js";

export function OfflinePage() {
  const isOnline = useMobileUIStore((s) => s.isOnline);

  const handleRetry = useCallback(async () => {
    try {
      await fetch("/api/conversations", { signal: AbortSignal.timeout(5000) });
      useMobileUIStore.getState().setOnline(true);
    } catch {
      useMobileUIStore.getState().setOnline(false);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-6 pt-safe pb-safe">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        未连接到网络
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
        请检查您的网络连接后重试
      </p>
      <button
        onClick={handleRetry}
        disabled={isOnline}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 disabled:opacity-50 touch-target"
      >
        {isOnline ? "已连接" : "重试"}
      </button>
    </div>
  );
}
