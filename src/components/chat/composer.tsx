import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  streaming,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-4 md:px-4">
      <div
        className={cn(
          "rounded-3xl bg-composer p-2 pl-4 shadow-composer",
          "focus-within:ring-1 focus-within:ring-ring/30",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled && !streaming}
          placeholder={placeholder ?? "Message Ollama UI"}
          className="max-h-52 min-h-12 w-full resize-none bg-transparent py-3 text-base leading-6 text-foreground outline-none placeholder:text-subtle"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (streaming) return;
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-end pb-1">
          {streaming ? (
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={onSend}
              disabled={disabled || !value.trim()}
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Replies come from the model you selected. Check anything important.
      </p>
    </div>
  );
}
