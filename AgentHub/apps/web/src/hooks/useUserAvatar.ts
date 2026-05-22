import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "user-avatar";
const MAX_SIZE = 3 * 1024 * 1024; // 3 MB for localStorage data URL

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAvatar(stored);
    } catch {
      // localStorage not available
    }
  }, []);

  const uploadAvatar = useCallback((dataUrl: string): string | null => {
    // Check data URL size (base64 is ~1.37x the original binary size)
    if (dataUrl.length > MAX_SIZE * 1.5) {
      return "图片过大，请选择小于 3MB 的文件";
    }
    try {
      localStorage.setItem(STORAGE_KEY, dataUrl);
      setAvatar(dataUrl);
      return null; // no error = success
    } catch {
      return "存储失败，可能空间不足，请清理浏览器存储后重试";
    }
  }, []);

  const clearAvatar = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAvatar(null);
  }, []);

  return { avatar, uploadAvatar, clearAvatar };
}
