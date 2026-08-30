import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LoaderCircle, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  QUERY_SUGGESTIONS,
  pullIdsFor,
  sameOllamaId,
  stripQuantSuffix,
  suggestQueries,
  type LibraryModel,
} from "@/lib/llm/library";
import { fetchSetup, isAbortError, listHfQuants, readSetupStream, searchLibrary, type SetupStatus } from "@/lib/llm/setup";
import { PairSuggestions } from "@/components/chat/pair-suggestions";
import type { ModelRef } from "@/lib/chat/types";
import { cn, formatBytes, formatContextWindow } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import { useHistoryBack } from "@/lib/history-back";

const EMPTY_CHIPS = QUERY_SUGGESTIONS.slice(0, 10);

export function ModelHub({
  host,
  localModels,
  onChoose,
  onRefreshLocal,
  initialQuery = "",
  hideStart = false,
  hideLocal = false,
  onOllamaReady,
}: {
  host: string;
  localModels: ModelRef[];
  onChoose: (model: ModelRef) => void;
  onRefreshLocal: () => Promise<ModelRef[] | void>;
  initialQuery?: string;
  hideStart?: boolean;
  hideLocal?: boolean;
  onOllamaReady?: (ready: boolean) => Promise<unknown> | void;
}) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [library, setLibrary] = useState<LibraryModel[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(EMPTY_CHIPS);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [pulls, setPulls] = useState<Record<string, number>>({});
  const pullingRef = useRef(new Set<string>());
  const abortRef = useRef(new Map<string, AbortController>());
  const [pendingDelete, setPendingDelete] = useState<ModelRef | null>(null);
  useHistoryBack(Boolean(pendingDelete), () => setPendingDelete(null), "delete-model");
  const [deleting, setDeleting] = useState(false);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);
  const [arrowed, setArrowed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = useChatStore((s) => s.settings.locale);

  async function refreshStatus() {
    const next = await fetchSetup(host);
    setStatus(next);
    return next;
  }

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    void refreshStatus();
    const id = window.setInterval(() => void refreshStatus(), 8000);
    return () => {
      window.clearInterval(id);
      for (const ac of abortRef.current.values()) ac.abort();
      abortRef.current.clear();
    };
  }, [host]);

  const localSuggest = useMemo(() => suggestQueries(query), [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void searchLibrary(query).then((next) => {
        setLibrary(next.models);
        setSuggestions(next.suggestions.length ? next.suggestions : localSuggest);
      });
    }, query ? 220 : 0);
    return () => window.clearTimeout(handle);
  }, [query, localSuggest]);

  const shownSuggest = (suggestions.length ? suggestions : localSuggest).slice(0, 8);

  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localModels;
    return localModels.filter((m) =>
      `${m.name} ${m.id} ${m.family ?? ""} ${m.parameterSize ?? ""}`.toLowerCase().includes(q),
    );
  }, [localModels, query]);

  const ollamaLibrary = library.filter((m) => (m.source || "ollama") === "ollama");
  const hfLibrary = library.filter((m) => m.source === "huggingface" || m.source === "url");

  function pushLog(line: string) {
    setLog((cur) => [...cur.slice(-12), line]);
  }

  async function installOllama() {
    setBusy("install");
    setLog(["Installing Ollama…"]);
    try {
      const ok = await readSetupStream("/api/setup-install", pushLog, { method: "POST" });
      const next = await refreshStatus();
      const ready = Boolean(ok && next.running);
      if (ok) pushLog("Ollama is ready.");
      await onOllamaReady?.(ready);
    } catch (err) {
      pushLog(err instanceof Error ? err.message : "Install failed");
      await onOllamaReady?.(false);
    } finally {
      setBusy(null);
    }
  }

  async function startOllama() {
    setBusy("start");
    setLog(["Starting Ollama…"]);
    try {
      const ok = await readSetupStream("/api/setup-start", pushLog, { method: "POST" });
      const next = await refreshStatus();
      const ready = Boolean(ok && next.running);
      await onOllamaReady?.(ready);
    } catch (err) {
      pushLog(err instanceof Error ? err.message : "Could not start Ollama");
      await onOllamaReady?.(false);
    } finally {
      setBusy(null);
    }
  }

  async function installModel(id: string, opts?: { select?: boolean }): Promise<boolean> {
    if (!status?.running) {
      pushLog("Install or start Ollama first.");
      return false;
    }
    if (pullingRef.current.has(id)) return false;
    pullingRef.current.add(id);
    const ac = new AbortController();
    abortRef.current.set(id, ac);
    setPulls((cur) => ({ ...cur, [id]: 0 }));
    pushLog(`Installing ${id}…`);
    let succeeded = false;
    try {
      const ok = await readSetupStream(
        "/api/pull",
        (line) => pushLog(`${id}: ${line}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host, model: id }),
          signal: ac.signal,
        },
        (pct) => setPulls((cur) => ({ ...cur, [id]: pct })),
      );
      const models = (await onRefreshLocal()) ?? [];
      const match = models.find(
        (m) => sameOllamaId(m.id, id) || m.id.startsWith(`${id}:`) || id.startsWith(`${m.id}:`) || m.id.includes(id),
      );
      if (ok) {
        succeeded = true;
        setPulls((cur) => ({ ...cur, [id]: 100 }));
        pushLog(`${id} is ready.`);
        if (opts?.select !== false && match) onChoose(match);
      }
      return ok;
    } catch (err) {
      if (isAbortError(err) || ac.signal.aborted) {
        pushLog(`${id}: cancelled`);
        toast.message(`Stopped ${id}`);
        return false;
      }
      pushLog(err instanceof Error ? `${id}: ${err.message}` : `${id}: Download failed`);
      return false;
    } finally {
      pullingRef.current.delete(id);
      abortRef.current.delete(id);
      if (succeeded) {
        window.setTimeout(() => {
          setPulls((cur) => {
            if (!(id in cur)) return cur;
            const next = { ...cur };
            delete next[id];
            return next;
          });
        }, 800);
      } else {
        setPulls((cur) => {
          if (!(id in cur)) return cur;
          const next = { ...cur };
          delete next[id];
          return next;
        });
      }
    }
  }

  function cancelInstall(id: string) {
    const ac = abortRef.current.get(id);
    if (!ac) return;
    ac.abort();
  }

  async function deleteModel(model: ModelRef) {
    setDeleting(true);
    pushLog(`Removing ${model.id}…`);
    try {
      const res = await fetch("/api/delete-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, model: model.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.error || "Could not delete the model");
      pushLog(`${model.id} was removed.`);
      toast.success(`Removed ${model.name}`);
      setPendingDelete(null);
      await onRefreshLocal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete the model";
      pushLog(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  function applySuggest(value: string) {
    setQuery(value);
    setOpenSuggest(false);
    inputRef.current?.focus();
  }

  const osLabel = status?.osLabel ?? "this computer";

  return (
    <div className="flex flex-col gap-6">
      {hideStart && status?.running ? null : status?.running || !hideStart ? (
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
            ? "Search Ollama and Hugging Face, or paste a model link. A name like qwen lists every matching model, not only ones already installed."
            : status?.installed
              ? "Start Ollama, then search Ollama and Hugging Face from here."
              : "Install Ollama for this computer, then search for a model such as qwen or llama."}
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
      ) : null}

      {!hideLocal && localFiltered.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t(locale, "onThisComputer")}
          </h2>
          <div className="flex flex-col gap-2">
            {localFiltered.map((model) => (
              <div
                key={`${model.provider}:${model.id}:${model.transport}`}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onChoose(model)}
                  className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left hover:bg-accent"
                >
                  <span className="block truncate font-medium text-ready">{model.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[formatContextWindow(model.contextLength), model.parameterSize, formatBytes(model.size)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-11 shrink-0"
                  onClick={() => onChoose(model)}
                >
                  {t(locale, "useModel")}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t(locale, "deleteNamed", { title: model.name })}
                  disabled={deleting}
                  onClick={() => setPendingDelete(model)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={openSuggest && shownSuggest.length > 0}
          aria-controls="model-search-suggestions"
          placeholder={t(locale, "searchLibraryPh")}
          className="h-11 ps-9"
          autoComplete="off"
          onFocus={() => setOpenSuggest(true)}
          onBlur={() => window.setTimeout(() => setOpenSuggest(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenSuggest(true);
            setActiveSuggest(0);
            setArrowed(false);
          }}
          onKeyDown={(e) => {
            if (!openSuggest || shownSuggest.length === 0) {
              if (e.key === "Escape") setOpenSuggest(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setArrowed(true);
              setActiveSuggest((i) => (i + 1) % shownSuggest.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setArrowed(true);
              setActiveSuggest((i) => (i - 1 + shownSuggest.length) % shownSuggest.length);
            } else if (e.key === "Enter") {
              if (arrowed && shownSuggest[activeSuggest] && query !== shownSuggest[activeSuggest]) {
                e.preventDefault();
                applySuggest(shownSuggest[activeSuggest]!);
              } else {
                setOpenSuggest(false);
              }
            } else if (e.key === "Escape") {
              setOpenSuggest(false);
            }
          }}
        />
        {openSuggest && query.trim() && shownSuggest.length > 0 ? (
          <ul
            id="model-search-suggestions"
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-[var(--composer-shadow)]"
          >
            {shownSuggest.map((item, i) => (
              <li key={item} role="option" aria-selected={i === activeSuggest}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-sm hover:bg-accent",
                    i === activeSuggest && "bg-accent",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggest(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!query.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {EMPTY_CHIPS.map((item) => (
            <Button key={item} size="sm" variant="secondary" className="h-8" onClick={() => applySuggest(item)}>
              {item}
            </Button>
          ))}
        </div>
      ) : null}

      <PairSuggestions
        models={localModels}
        query={query}
        onRefreshLocal={onRefreshLocal}
      />

      <LibrarySection
        title="Ollama library"
        empty={
          query.trim()
            ? "No Ollama library matches. Try qwen, llama, or a Hugging Face link."
            : "Search above to see every matching model, not only the ones on this computer."
        }
        models={ollamaLibrary}
        localIds={new Set(localModels.map((m) => m.id))}
        pulls={pulls}
        disabled={!status?.running}
        onInstall={(id) => void installModel(id)}
        onCancel={cancelInstall}
        onUse={(id) => {
          const match = localModels.find((m) => sameOllamaId(m.id, id) || m.id.includes(id));
          if (match) onChoose(match);
        }}
      />

      <LibrarySection
        title="Hugging Face"
        empty={
          query.trim()
            ? "No GGUF matches on Hugging Face for that search."
            : "Type a name or paste a Hugging Face / ModelScope / Ollama link."
        }
        models={hfLibrary}
        localIds={new Set(localModels.map((m) => m.id))}
        pulls={pulls}
        disabled={!status?.running}
        onInstall={(id) => void installModel(id)}
        onCancel={cancelInstall}
        onUse={(id) => {
          const match = localModels.find((m) => sameOllamaId(m.id, id) || m.id.includes(id));
          if (match) onChoose(match);
        }}
      />

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this model?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `“${pendingDelete.name}” will be removed from this computer. This cannot be undone. Shared layers used by other models are kept.`
                : "This model will be removed from this computer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={deleting} onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                if (pendingDelete) void deleteModel(pendingDelete);
              }}
            >
              {deleting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LibrarySection({
  title,
  empty,
  models,
  localIds,
  pulls,
  disabled,
  onInstall,
  onCancel,
  onUse,
}: {
  title: string;
  empty: string;
  models: LibraryModel[];
  localIds: Set<string>;
  pulls: Record<string, number>;
  disabled: boolean;
  onInstall: (id: string) => void;
  onCancel: (id: string) => void;
  onUse: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="flex flex-col gap-2">
        {models.map((item) => (
          <LibraryCard
            key={item.pullId || item.name}
            model={item}
            localIds={localIds}
            pulls={pulls}
            disabled={disabled}
            onInstall={onInstall}
            onCancel={onCancel}
            onUse={onUse}
          />
        ))}
        {models.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : null}
      </div>
    </section>
  );
}

function tagLabel(id: string, family: string) {
  if (id === family) return "latest";
  if (id.startsWith(`${family}:`)) return id.slice(family.length + 1);
  if (id.includes(":")) return id.split(":").pop() || id;
  return id;
}

function LibraryCard({
  model,
  localIds,
  pulls,
  disabled,
  onInstall,
  onCancel,
  onUse,
}: {
  model: LibraryModel;
  localIds: Set<string>;
  pulls: Record<string, number>;
  disabled: boolean;
  onInstall: (id: string) => void;
  onCancel: (id: string) => void;
  onUse: (id: string) => void;
}) {
  const [extra, setExtra] = useState<string[]>([]);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const ids = uniqueIds([
    ...pullIdsFor(model),
    ...extra.map((tag) => `${stripQuantSuffix(model.pullId || "")}:${tag}`),
  ]).filter((id) => id && !id.endsWith(":"));
  const hf = model.source === "huggingface" || model.source === "url";

  async function loadSizes() {
    if (!model.repo) return;
    setLoadingSizes(true);
    try {
      const quants = await listHfQuants(model.repo);
      setExtra(quants);
    } finally {
      setLoadingSizes(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium text-pretty">{model.name}</p>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {hf ? "Hugging Face" : "Ollama"}
        </span>
      </div>
      {model.description ? (
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{model.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 pt-2 pe-2">
        {ids.map((id) => {
          const have = [...localIds].some((local) => sameOllamaId(local, id) || local.includes(id));
          const percent = pulls[id];
          const rowActive = percent != null;
          const ready = have || (rowActive && percent >= 100);
          const shown = rowActive ? Math.max(4, Math.min(100, percent)) : 0;
          const short = tagLabel(id, model.name);
          const label = have
            ? `Use ${short}`
            : hf
              ? id.includes(":")
                ? `Install ${short}`
                : "Install from Hugging Face"
              : `Install ${short}`;
          return (
            <div key={id} className="relative flex items-start gap-0.5">
              {rowActive && percent < 100 ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute -top-2 -end-2 z-20 size-6 rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                  aria-label={`Cancel ${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel(id);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={have ? "secondary" : "outline"}
                className={cn(
                  "relative h-8 overflow-hidden",
                  rowActive && "min-w-40 pe-8",
                  have && "ring-1 ring-ring/30",
                )}
                disabled={(disabled && !have) || (rowActive && percent < 100)}
                aria-busy={rowActive || undefined}
                onClick={() => (have ? onUse(id) : onInstall(id))}
              >
                {rowActive ? <InstallProgress percent={shown} /> : null}
                <span
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 transition-colors duration-200 ease-out",
                    ready && "text-ready",
                  )}
                >
                  {rowActive && percent < 100 ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                  {label}
                  {rowActive ? <span className="font-mono tabular-nums">{Math.round(percent)}%</span> : null}
                </span>
              </Button>
            </div>
          );
        })}
        {hf && model.repo && extra.length === 0 ? (
          <Button size="sm" variant="ghost" className="h-8" disabled={loadingSizes} onClick={() => void loadSizes()}>
            {loadingSizes ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            More sizes
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function InstallProgress({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="model-install-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
    >
      <div className="model-install-fill" style={{ transform: `scaleX(${p / 100})` }} />
      {p < 100 ? (
        <div className="model-install-edge-wrap" style={{ transform: `translateX(${p}%)` }}>
          <div className="model-install-edge" />
        </div>
      ) : null}
      <div className="model-install-bar">
        <span style={{ transform: `scaleX(${p / 100})` }} />
      </div>
    </div>
  );
}

function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
