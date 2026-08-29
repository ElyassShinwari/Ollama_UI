import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, Cpu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn, formatBytes, formatContextWindow } from "@/lib/utils";
import { CLOUD_LABEL } from "@/lib/llm/cloud";
import { suggestQueries } from "@/lib/llm/library";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import type { ModelRef, Provider } from "@/lib/chat/types";

function groupModels(models: ModelRef[]) {
  return [
    { title: "On this machine", items: models.filter((m) => m.provider === "ollama") },
    { title: CLOUD_LABEL.openai, items: models.filter((m) => m.provider === "openai") },
    { title: CLOUD_LABEL.anthropic, items: models.filter((m) => m.provider === "anthropic") },
    { title: CLOUD_LABEL.xai, items: models.filter((m) => m.provider === "xai") },
    { title: CLOUD_LABEL.kimi, items: models.filter((m) => m.provider === "kimi") },
    { title: CLOUD_LABEL.deepseek, items: models.filter((m) => m.provider === "deepseek") },
  ].filter((g) => g.items.length > 0);
}

function matchesQuery(model: ModelRef, query: string) {
  if (!query) return true;
  const hay = `${model.name} ${model.id} ${model.family ?? ""} ${model.provider} ${CLOUD_LABEL[model.provider as Exclude<Provider, "ollama">] ?? "ollama"}`.toLowerCase();
  return hay.includes(query);
}

export function ModelPicker({
  models,
  value,
  onChange,
  onBrowse,
  align = "start",
  className,
  allowCycle = true,
  emptyLabel,
}: {
  models: ModelRef[];
  value: ModelRef | null;
  onChange: (model: ModelRef) => void;
  onBrowse?: (query?: string) => void;
  align?: "start" | "center" | "end";
  className?: string;
  allowCycle?: boolean;
  emptyLabel?: string;
}) {
  const locale = useChatStore((s) => s.settings.locale);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => models.filter((m) => matchesQuery(m, q)), [models, q]);
  const groups = groupModels(visible);
  const label = value?.name ?? emptyLabel ?? t(locale, "chooseModel");
  const index = models.findIndex((m) => m.id === value?.id && m.provider === value?.provider);
  const hints = q ? suggestQueries(q, models.map((m) => m.name)) : [];

  function cycle(dir: -1 | 1) {
    if (models.length === 0) return;
    const from = index < 0 ? 0 : index;
    const next = models[(from + dir + models.length) % models.length];
    if (next) onChange(next);
  }

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      {allowCycle ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="hidden md:inline-flex"
          aria-label={t(locale, "prevModel")}
          disabled={models.length < 2}
          onClick={() => cycle(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setQuery("");
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn("h-9 min-w-0 max-w-full gap-1.5 px-2 font-medium md:max-w-[min(100%,20rem)] md:px-2.5", className)}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="flex w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0">
          <div className="border-b border-border p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or try qwen, llama…"
              autoComplete="off"
              className="h-8"
              onKeyDown={(e) => e.stopPropagation()}
            />
            {q && hints.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {hints.slice(0, 6).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground hover:bg-accent"
                    onClick={() => setQuery(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="scrollbar-thin max-h-[min(24rem,60vh)] overflow-y-auto p-1">
            {models.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No models found yet.</div>
            ) : visible.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No installed model matches “{query.trim()}”.
              </div>
            ) : (
              groups.map((group, i) => (
                <div key={group.title}>
                  {i > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel>{group.title}</DropdownMenuLabel>
                  {group.items.map((model) => (
                    <ModelItem
                      key={`${model.provider}:${model.id}:${model.transport}`}
                      model={model}
                      selected={value?.id === model.id && value.provider === model.provider}
                      onSelect={() => onChange(model)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
          {onBrowse ? (
            <>
              <DropdownMenuSeparator className="my-0" />
              <div className="p-1">
                {q ? (
                  <DropdownMenuItem onSelect={() => onBrowse(query.trim())} className="py-2.5">
                    <Search className="size-4" />
                    <span>Search library for “{query.trim()}”</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => onBrowse()} className="py-2.5">
                  <Plus className="size-4" />
                  <span>Install or remove models</span>
                </DropdownMenuItem>
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {allowCycle ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="hidden md:inline-flex"
          aria-label={t(locale, "nextModel")}
          disabled={models.length < 2}
          onClick={() => cycle(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function ModelItem({
  model,
  selected,
  onSelect,
}: {
  model: ModelRef;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = [
    model.parameterSize,
    formatContextWindow(model.contextLength),
    formatBytes(model.size),
    model.family,
    model.provider === "ollama"
      ? model.transport === "browser"
        ? "This computer"
        : "Ollama"
      : (CLOUD_LABEL[model.provider as Exclude<Provider, "ollama">] ?? "Cloud"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn("items-start gap-2 py-2", selected && "bg-accent")}
    >
      {model.provider === "ollama" ? <Cpu className="mt-0.5 size-4" /> : <Cloud className="mt-0.5 size-4" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{model.name}</span>
        {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
      </span>
      {selected ? <Check className="mt-0.5 size-4" /> : null}
    </DropdownMenuItem>
  );
}
