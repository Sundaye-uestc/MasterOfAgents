import { useEffect, useCallback } from "react";
import { useMobileUIStore } from "../stores/mobile-ui.store.js";

const PING_URL = "/api/conversations";

export function useNetworkStatus() {
  const setOnline = useMobileUIStore((s) => s.setOnline);
  const push = useMobileUIStore((s) => s.push);
  const stack = useMobileUIStore((s) => s.stack);

  const checkOnline = useCallback(async () => {
    const browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!browserOnline) {
      setOnline(false);
      return;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(PING_URL, { signal: controller.signal });
      clearTimeout(timeout);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [setOnline]);

  useEffect(() => {
    checkOnline();

    const handleOnline = () => checkOnline();
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(checkOnline, 30_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkOnline, setOnline]);

  // Push/pop offline page when online status changes
  const isOnline = useMobileUIStore((s) => s.isOnline);
  useEffect(() => {
    const top = stack[stack.length - 1];
    if (!isOnline && top?.name !== "offline") {
      push("offline");
    } else if (isOnline && top?.name === "offline") {
      // pop the offline page
      useMobileUIStore.getState().pop();
    }
  }, [isOnline, stack, push]);
}
