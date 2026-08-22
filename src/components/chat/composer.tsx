import { useEffect, useRef } from "react";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingFile } from "@/lib/llm/files";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  streaming,
  placeholder,
  files,
  onRemoveFile,
  onPickFiles,
  accept,
  onFileInput,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
  files: PendingFile[];
  onRemoveFile: (id: string) => void;
  onPickFiles: () => void;
  accept: string;
  onFileInput: (list: FileList | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = Boolean(value.trim() || files.length);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-4 md:px-4">
      <div
        className={cn(
          "rounded-3xl bg-composer p-2 shadow-composer",
          "focus-within:ring-1 focus-within:ring-ring/30",
        )}
      >
        {files.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-2 pt-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex max-w-full items-center gap-2 rounded-xl border border-border bg-secondary px-2 py-1.5"
              >
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt="" className="size-8 rounded-md object-cover" />
                ) : null}
                <span className="max-w-xs truncate text-xs">{file.name}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemoveFile(file.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled && !streaming}
          placeholder={placeholder ?? "Message Ollama UI"}
          className="max-h-52 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-base leading-6 text-foreground outline-none placeholder:text-subtle"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (streaming || !canSend) return;
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between px-1 pb-1">
          <div>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              multiple
              accept={accept || undefined}
              onChange={(e) => {
                onFileInput(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full"
              aria-label="Add file"
              disabled={streaming || disabled}
              onClick={() => {
                inputRef.current?.click();
                onPickFiles();
              }}
            >
              <Plus className="size-5" />
            </Button>
          </div>
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
              disabled={disabled || !canSend}
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
