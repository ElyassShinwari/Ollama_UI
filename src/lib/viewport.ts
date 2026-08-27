import { useEffect } from "react";

function syncAppHeight() {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  const height = vv ? Math.round(vv.height) : Math.round(window.innerHeight);
  const root = document.documentElement;
  root.style.setProperty("--app-height", `${Math.max(240, height)}px`);
  if (vv && (vv.offsetTop > 0 || window.scrollY !== 0)) {
    window.scrollTo(0, 0);
  }
}

export function keepNodeInView(node: HTMLElement | null) {
  if (!node) return;
  const vv = window.visualViewport;
  const rect = node.getBoundingClientRect();
  if (!vv) {
    node.scrollIntoView({ block: "nearest" });
    return;
  }
  const top = vv.offsetTop;
  const bottom = vv.offsetTop + vv.height;
  if (rect.bottom > bottom - 12 || rect.top < top + 8) {
    node.scrollIntoView({ block: "end", inline: "nearest" });
    window.scrollTo(0, 0);
  }
}

/** Keep the app height on the visible viewport so the composer stays above the phone keyboard. */
export function useAppViewport() {
  useEffect(() => {
    syncAppHeight();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncAppHeight);
    vv?.addEventListener("scroll", syncAppHeight);
    window.addEventListener("resize", syncAppHeight);
    window.addEventListener("orientationchange", syncAppHeight);
    window.addEventListener("focusin", syncAppHeight);
    window.addEventListener("focusout", syncAppHeight);
    return () => {
      vv?.removeEventListener("resize", syncAppHeight);
      vv?.removeEventListener("scroll", syncAppHeight);
      window.removeEventListener("resize", syncAppHeight);
      window.removeEventListener("orientationchange", syncAppHeight);
      window.removeEventListener("focusin", syncAppHeight);
      window.removeEventListener("focusout", syncAppHeight);
    };
  }, []);
}
