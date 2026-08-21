import { useMemo, useState, type ReactNode } from "react";
import { Cloud, Cpu, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FlameMark } from "@/components/chat/sidebar";
import { cn, formatBytes, formatContextWindow } from "@/lib/utils";
import type { ModelCatalog, ModelRef } from "@/lib/chat/types";

export function ConnectScreen({
  catalog,
  host,
  onHostCommit,
  onRefresh,
  onScanLocal,
  onChoose,
}: {
  catalog: ModelCatalog;
  host: string;
  onHostCommit: (host: string) => void;
  onRefresh: () => void;
  onScanLocal: () => void;
  onChoose: (model: ModelRef) => void;
}) {
  const [query, setQuery] = useState("");
  const [hostDraft, setHostDraft] = useState(host);
  const { models, status } = catalog;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) =>
      `${m.name} ${m.family ?? ""} ${m.parameterSize ?? ""}`.toLowerCase().includes(q),
    );
  }, [models, query]);

  const ollama = filtered.filter((m) => m.provider === "ollama");
  const xai = filtered.filter((m) => m.provider === "xai");

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-10 md:py-14">
        <div className="mb-8">
          <FlameMark className="mb-5 size-10" />
          <h1 className="font-serif text-4xl tracking-tight text-balance md:text-5xl">
            Choose a local model
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground text-pretty">
            Ollama UI lists every model already downloaded on this computer. Switch
            models anytime from the chat header.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter models"
            className="h-11 flex-1"
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="h-11 flex-1 sm:flex-none" onClick={onRefresh}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={onScanLocal}>
              <Monitor className="size-4" />
              This PC
            </Button>
          </div>
        </div>

        {status.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <div>
            {ollama.length > 0 && (
              <ModelGroup title="On this machine" icon={<Cpu className="size-3.5" />}>
                {ollama.map((model) => (
                  <ModelCard
                    key={`${model.provider}:${model.id}:${model.transport}`}
                    model={model}
                    onChoose={onChoose}
                  />
                ))}
              </ModelGroup>
            )}
            {xai.length > 0 && (
              <ModelGroup title="Cloud" icon={<Cloud className="size-3.5" />}>
                {xai.map((model) => (
                  <ModelCard
                    key={`${model.provider}:${model.id}`}
                    model={model}
                    onChoose={onChoose}
                  />
                ))}
              </ModelGroup>
            )}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
                <p className="font-medium">No models found</p>
                <p className="mt-2 text-sm text-muted-foreground text-pretty">
                  Start Ollama, pull a model such as smollm2:135m, scan this computer,
                  or point Ollama UI at another host below.
                </p>
              </div>
            )}
          </div>
        )}

        <form
          className="mt-8 flex flex-col gap-2 border-t border-border pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            onHostCommit(hostDraft.trim() || "http://127.0.0.1:11434");
          }}
        >
          <label htmlFor="connect-host" className="text-sm font-medium">
            Ollama host
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="connect-host"
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              placeholder="http://127.0.0.1:11434"
            />
            <Button type="submit" variant="secondary">
              Look there
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModelGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ModelCard({ model, onChoose }: { model: ModelRef; onChoose: (m: ModelRef) => void }) {
  const meta = [
    model.parameterSize,
    formatContextWindow(model.contextLength),
    formatBytes(model.size),
    model.family,
    model.provider === "xai" ? "Cloud" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onChoose(model)}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left",
        "transition-[background-color,border-color] duration-150 hover:border-ring/40 hover:bg-accent",
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {model.provider === "xai" ? <Cloud className="size-4" /> : <Cpu className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{model.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta || "Ready"}</span>
      </span>
    </button>
  );
}
