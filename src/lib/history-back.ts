import { useEffect, useRef } from "react";

const live = new Map<string, number>();

/**
 * Phone / browser Back closes this overlay instead of leaving the app.
 * Nested overlays each push a history entry so Back peels them one at a time.
 */
export function useHistoryBack(open: boolean, onClose: () => void, key: string) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const n = (live.get(key) ?? 0) + 1;
    live.set(key, n);
    const state = window.history.state as { ollamaUiOverlay?: string } | null;
    if (n === 1 && state?.ollamaUiOverlay !== key) {
      window.history.pushState({ ollamaUiOverlay: key }, "");
    }

    let closedByPop = false;
    const onPop = () => {
      closedByPop = true;
      live.set(key, 0);
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      const left = Math.max(0, (live.get(key) ?? 1) - 1);
      live.set(key, left);
      if (left > 0 || closedByPop) return;
      queueMicrotask(() => {
        if ((live.get(key) ?? 0) > 0) return;
        const st = window.history.state as { ollamaUiOverlay?: string } | null;
        if (st?.ollamaUiOverlay === key) window.history.back();
      });
    };
  }, [open, key]);
}
