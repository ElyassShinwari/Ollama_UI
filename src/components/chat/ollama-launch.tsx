import { useEffect, useState } from "react";
import { Download, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchSetup, readSetupStream, type SetupStatus } from "@/lib/llm/setup";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function OllamaLaunch({
  host,
  onReady,
  variant = "hero",
}: {
  host: string;
  onReady?: () => Promise<unknown> | void;
  variant?: "hero" | "page";
}) {
  const locale = useChatStore((s) => s.settings.locale);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [busy, setBusy] = useState<"start" | "install" | null>(null);
  const [log, setLog] = useState<string[]>([]);

  async function refresh() {
    const next = await fetchSetup(host);
    setStatus(next);
    return next;
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [host]);

  if (status?.running) return null;

  function pushLog(line: string) {
    setLog((cur) => [...cur.slice(-8), line]);
  }

  async function run(kind: "start" | "install") {
    setBusy(kind);
    setLog([kind === "install" ? "Installing Ollama…" : "Starting Ollama…"]);
    try {
      const ok = await readSetupStream(
        kind === "install" ? "/api/setup-install" : "/api/setup-start",
        pushLog,
        { method: "POST" },
      );
      const next = await refresh();
      await onReady?.();
      if (ok && next.running) {
        toast.success("Ollama is running");
      } else if (!ok) {
        toast.error(kind === "install" ? "Could not install Ollama" : "Could not start Ollama");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : kind === "install" ? "Install failed" : "Could not start Ollama";
      pushLog(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const installed = Boolean(status?.installed);
  const checking = !status;
  const label = installed ? t(locale, "startOllama") : t(locale, "installOllama");
  const lead = checking
    ? t(locale, "checkingOllama")
    : installed
      ? t(locale, "ollamaNotRunning")
      : t(locale, "ollamaNotInstalled");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "h-full min-h-0 px-6" : "min-h-[42vh] py-8",
      )}
    >
      <p className="max-w-md font-serif text-3xl tracking-tight text-balance md:text-4xl">{lead}</p>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground text-pretty">{t(locale, "ollamaStartHint")}</p>
      <Button
        type="button"
        className="mt-8 h-16 min-w-64 rounded-2xl px-8 text-xl"
        disabled={checking || Boolean(busy)}
        onClick={() => void run(installed ? "start" : "install")}
      >
        {busy || checking ? <LoaderCircle className="size-6 animate-spin" /> : installed ? <Sparkles className="size-6" /> : <Download className="size-6" />}
        {busy === "start" ? t(locale, "startingOllama") : busy === "install" ? t(locale, "installingOllama") : label}
      </Button>
      {log.length > 0 ? (
        <pre className="mt-6 max-h-28 w-full max-w-md overflow-auto rounded-xl bg-secondary px-3 py-2 text-start font-mono text-[11px] leading-5 text-muted-foreground">
          {log.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}

export function ollamaIsUp(status: { ollamaBrowser?: boolean; ollamaServer?: boolean } | undefined) {
  return Boolean(status?.ollamaBrowser || status?.ollamaServer);
}
