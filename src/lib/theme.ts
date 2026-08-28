export type ThemeMode = "light" | "dark" | "system";

export function resolvedTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolvedTheme(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0c0c0d" : "#f4f1ea");
}

export const THEME_BOOT = `(function(){try{var t="light";var raw=localStorage.getItem("ollama-ui")||localStorage.getItem("hearth-chat");if(raw){var p=JSON.parse(raw);t=(p&&p.state&&p.state.settings&&p.state.settings.theme)||t;}var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.classList.toggle("light",!dark);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"#0c0c0d":"#f4f1ea");}catch(e){}})();`;
