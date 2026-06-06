import { useState, useCallback, useEffect } from "react";
import { getProfile, updateProfile } from "../lib/api.js";

const MAX_SIZE = 3 * 1024 * 1024; // 3 MB for data URL

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load avatar from server on mount
  useEffect(() => {
    getProfile()
      .then((p) => setAvatar(p.avatar))
      .catch(() => {
        // Fallback: try legacy localStorage
        try {
          const stored = localStorage.getItem("user-avatar");
          if (stored) {
            setAvatar(stored);
            // Migrate to server
            updateProfile({ avatar: stored }).catch(() => {});
          }
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false));
  }, []);

  const uploadAvatar = useCallback((dataUrl: string): string | null => {
    if (dataUrl.length > MAX_SIZE * 1.5) {
      return "图片过大，请选择小于 3MB 的文件";
    }
    updateProfile({ avatar: dataUrl })
      .then(() => setAvatar(dataUrl))
      .catch(() => {
        // Fallback: localStorage
        try {
          localStorage.setItem("user-avatar", dataUrl);
          setAvatar(dataUrl);
        } catch {
          return;
        }
      });
    return null; // no error
  }, []);

  const clearAvatar = useCallback(() => {
    updateProfile({ avatar: null })
      .then(() => setAvatar(null))
      .catch(() => {
        try { localStorage.removeItem("user-avatar"); } catch { /* ignore */ }
        setAvatar(null);
      });
  }, []);

  return { avatar, loading, uploadAvatar, clearAvatar };
}
