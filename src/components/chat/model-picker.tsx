import { Check, ChevronDown, Cloud, Cpu } from "lucide-react";
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
import type { ModelRef } from "@/lib/chat/types";

export function ModelPicker({
  models,
  value,
  onChange,
  align = "start",
  className,
}: {
  models: ModelRef[];
  value: ModelRef | null;
  onChange: (model: ModelRef) => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const ollama = models.filter((m) => m.provider === "ollama");
  const xai = models.filter((m) => m.provider === "xai");
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
            {ollama.length > 0 && (
              <>
                <DropdownMenuLabel>On this machine</DropdownMenuLabel>
                {ollama.map((model) => (
                  <ModelItem
                    key={`${model.provider}:${model.id}:${model.transport}`}
                    model={model}
                    selected={value?.id === model.id && value.provider === model.provider}
                    onSelect={() => onChange(model)}
                  />
                ))}
              </>
            )}
            {ollama.length > 0 && xai.length > 0 && <DropdownMenuSeparator />}
            {xai.length > 0 && (
              <>
                <DropdownMenuLabel>Cloud</DropdownMenuLabel>
                {xai.map((model) => (
                  <ModelItem
                    key={`${model.provider}:${model.id}`}
                    model={model}
                    selected={value?.id === model.id && value.provider === model.provider}
                    onSelect={() => onChange(model)}
                  />
                ))}
              </>
            )}
          </>
        )}
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
    model.provider === "xai" ? "Cloud" : model.transport === "browser" ? "This computer" : "Ollama",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start py-2.5">
      <span className="mt-0.5 text-muted-foreground">
        {model.provider === "xai" ? <Cloud className="size-4" /> : <Cpu className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{model.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {selected && <Check className="mt-0.5 size-4" />}
    </DropdownMenuItem>
  );
}
