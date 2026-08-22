import { Check, ChevronDown, Cloud, Cpu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatBytes, formatContextWindow } from "@/lib/utils";
import { CLOUD_LABEL } from "@/lib/llm/cloud";
import type { ModelRef, Provider } from "@/lib/chat/types";

export function ModelPicker({
  models,
  value,
  onChange,
  onBrowse,
  align = "start",
  className,
}: {
  models: ModelRef[];
  value: ModelRef | null;
  onChange: (model: ModelRef) => void;
  onBrowse?: () => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const groups: { title: string; items: ModelRef[] }[] = [
    { title: "On this machine", items: models.filter((m) => m.provider === "ollama") },
    { title: CLOUD_LABEL.openai, items: models.filter((m) => m.provider === "openai") },
    { title: CLOUD_LABEL.anthropic, items: models.filter((m) => m.provider === "anthropic") },
    { title: CLOUD_LABEL.xai, items: models.filter((m) => m.provider === "xai") },
    { title: CLOUD_LABEL.kimi, items: models.filter((m) => m.provider === "kimi") },
    { title: CLOUD_LABEL.deepseek, items: models.filter((m) => m.provider === "deepseek") },
  ].filter((g) => g.items.length > 0);
  const label = value?.name ?? "Choose a model";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-9 max-w-[min(100%,20rem)] gap-1.5 px-2.5 font-medium", className)}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-80">
        {models.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No models found yet.
          </div>
        ) : (
          <>
            {groups.map((group, i) => (
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
            ))}
          </>
        )}
        {onBrowse ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onBrowse} className="py-2.5">
              <Plus className="size-4" />
              <span>Install a model</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
      : CLOUD_LABEL[model.provider as Exclude<Provider, "ollama">] ?? "Cloud",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start py-2.5">
      <span className="mt-0.5 text-muted-foreground">
        {model.provider === "ollama" ? <Cpu className="size-4" /> : <Cloud className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{model.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {selected && <Check className="mt-0.5 size-4" />}
    </DropdownMenuItem>
  );
}
