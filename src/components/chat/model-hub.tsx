import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pullIdsFor, sameOllamaId, type LibraryModel } from "@/lib/llm/library";
import { fetchSetup, readSetupStream, searchLibrary, type SetupStatus } from "@/lib/llm/setup";
import type { ModelRef } from "@/lib/chat/types";
import { cn, formatBytes, formatContextWindow } from "@/lib/utils";

export function ModelHub({
  host,
  localModels,
  onChoose,
  onRefreshLocal,
}: {
  host: string;
  localModels: ModelRef[];
  onChoose: (model: ModelRef) => void;
  onRefreshLocal: () => Promise<ModelRef[] | void>;
}) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<LibraryModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [pulling, setPulling] = useState<string | null>(null);

  async function refreshStatus() {
    const next = await fetchSetup(host);
    setStatus(next);
    return next;
  }

  useEffect(() => {
    void refreshStatus();
    const id = window.setInterval(() => void refreshStatus(), 8000);
    return () => window.clearInterval(id);
  }, [host]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void searchLibrary(query).then(setLibrary);
    }, query ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [query]);

  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localModels;
    return localModels.filter((m) =>
      `${m.name} ${m.family ?? ""} ${m.parameterSize ?? ""}`.toLowerCase().includes(q),
    );
  }, [localModels, query]);

  function pushLog(line: string) {
    setLog((cur) => [...cur.slice(-12), line]);
  }

  async function installOllama() {
    setBusy("install");
    setLog(["Installing Ollama…"]);
    try {
      const ok = await readSetupStream("/api/setup-install", pushLog, { method: "POST" });
      await refreshStatus();
      if (ok) pushLog("Ollama is ready.");
    } catch (err) {
      pushLog(err instanceof Error ? err.message : "Install failed");
    } finally {
      setBusy(null);
    }
  }

  async function startOllama() {
    setBusy("start");
    setLog(["Starting Ollama…"]);
    try {
      await readSetupStream("/api/setup-start", pushLog, { method: "POST" });
      await refreshStatus();
    } catch (err) {
      pushLog(err instanceof Error ? err.message : "Could not start Ollama");
    } finally {
      setBusy(null);
    }
  }

  async function installModel(id: string) {
    if (!status?.running) {
      pushLog("Install or start Ollama first.");
      return;
    }
    setPulling(id);
    setLog([`Installing ${id}…`]);
    try {
      const ok = await readSetupStream(
        "/api/pull",
        pushLog,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, model: id }),
        },
      );
      const models = (await onRefreshLocal()) ?? [];
      const match = models.find(
        (m) => sameOllamaId(m.id, id) || m.id.startsWith(`${id}:`) || id.startsWith(`${m.id}:`),
      );
      if (ok) {
        pushLog(`${id} is ready.`);
        if (match) onChoose(match);
      }
    } catch (err) {
      pushLog(err instanceof Error ? err.message : "Download failed");
    } finally {
      setPulling(null);
    }
  }

  const osLabel = status?.osLabel ?? "this computer";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card px-4 py-4">
        <p className="font-medium">
          {status?.running
            ? `Ollama is running on ${osLabel}`
            : status?.installed
              ? `Ollama is installed on ${osLabel}, but not running`
              : `Ollama is not installed on ${osLabel}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          {status?.running
            ? "Search the library and install a model with one click."
            : status?.installed
              ? "Start Ollama, then install a model from here."
              : "Install Ollama for this computer, then pick a model such as smollm2:135m."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!status?.installed ? (
            <Button onClick={() => void installOllama()} disabled={Boolean(busy)}>
              {busy === "install" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
              Install Ollama
            </Button>
          ) : !status.running ? (
            <Button onClick={() => void startOllama()} disabled={Boolean(busy)}>
              {busy === "start" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Start Ollama
            </Button>
          ) : null}
        </div>
        {log.length > 0 ? (
          <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-secondary px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
            {log.join("\n")}
          </pre>
        ) : null}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search local and library models"
            className="h-11 pl-9"
          />
        </div>
      </div>

      {localFiltered.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            On this computer
          </h2>
          <div className="flex flex-col gap-2">
            {localFiltered.map((model) => (
              <button
                key={`${model.provider}:${model.id}:${model.transport}`}
                type="button"
                onClick={() => onChoose(model)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{model.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[formatContextWindow(model.contextLength), model.parameterSize, formatBytes(model.size)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">Use</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Library
        </h2>
        <div className="flex flex-col gap-2">
          {library.map((item) => (
            <LibraryCard
              key={item.name}
              model={item}
              localIds={new Set(localModels.map((m) => m.id))}
              pulling={pulling}
              disabled={!status?.running || Boolean(pulling)}
              onInstall={(id) => void installModel(id)}
              onUse={(id) => {
                const match = localModels.find((m) => sameOllamaId(m.id, id));
                if (match) onChoose(match);
              }}
            />
          ))}
          {library.length === 0 ? (
            <p className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No library matches. Try smollm2:135m or llama3.2:1b.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function LibraryCard({
  model,
  localIds,
  pulling,
  disabled,
  onInstall,
  onUse,
}: {
  model: LibraryModel;
  localIds: Set<string>;
  pulling: string | null;
  disabled: boolean;
  onInstall: (id: string) => void;
  onUse: (id: string) => void;
}) {
  const ids = pullIdsFor(model);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-medium">{model.name}</p>
      {model.description ? (
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{model.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {ids.map((id) => {
          const have = [...localIds].some((local) => sameOllamaId(local, id));
          const active = pulling === id;
          return (
            <Button
              key={id}
              size="sm"
              variant={have ? "secondary" : "outline"}
              className={cn("h-8", have && "ring-1 ring-ring/30")}
              disabled={disabled && !have}
              onClick={() => (have ? onUse(id) : onInstall(id))}
            >
              {active ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {have ? `Use ${id}` : `Install & run ${id}`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
