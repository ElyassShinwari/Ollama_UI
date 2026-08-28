import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingFile } from "@/lib/llm/files";
import {
  createSpeechDraft,
  speechInputBlockedReason,
  speechRecognitionCtor,
  type SpeechRec,
} from "@/lib/speech";
import { keepNodeInView } from "@/lib/viewport";
import { localeInfo, t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";

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
  const recRef = useRef<SpeechRec | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const [listening, setListening] = useState(false);
  const locale = useChatStore((s) => s.settings.locale);

  valueRef.current = value;

  function keepComposerVisible() {
    window.requestAnimationFrame(() => keepNodeInView(wrapRef.current));
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    if (document.activeElement === el) keepComposerVisible();
  }, [value]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  function stopListening() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function startListening() {
    const blocked = speechInputBlockedReason();
    const Ctor = speechRecognitionCtor();
    if (blocked || !Ctor) {
      toast.error(
        blocked === "https"
          ? t(locale, "voiceNeedHttps")
          : blocked === "browser"
            ? t(locale, "voiceNeedBrowser")
            : t(locale, "voiceUnavailable"),
      );
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = localeInfo(locale).speech;
    const draft = createSpeechDraft(valueRef.current.trim());
    rec.onresult = (ev) => {
      onChange(draft.apply(ev));
    };
    rec.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      if (ev.error === "not-allowed") {
        toast.error(t(locale, "micDenied"));
      } else {
        toast.error(t(locale, "voiceStopped"));
      }
      recRef.current = null;
      setListening(false);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      toast.error(t(locale, "micFailed"));
    }
  }

  const canSend = Boolean(value.trim() || files.length);

  return (
    <div
      ref={wrapRef}
      className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-4"
    >
      <div
        className={cn(
          "rounded-3xl bg-composer p-2 shadow-composer",
          "focus-within:ring-1 focus-within:ring-ring/30",
          listening && "ring-1 ring-ring/40",
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
                  aria-label={t(locale, "removeFile", { name: file.name })}
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
          placeholder={listening ? t(locale, "listening") : (placeholder ?? t(locale, "chooseModelFirst"))}
          className="max-h-52 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-base leading-6 text-foreground outline-none placeholder:text-subtle"
          onChange={(e) => {
            if (listening) stopListening();
            onChange(e.target.value);
            keepComposerVisible();
          }}
          onFocus={keepComposerVisible}
          onPaste={(e) => {
            const pasted = e.clipboardData?.files;
            if (pasted && pasted.length > 0) {
              e.preventDefault();
              onFileInput(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (streaming || !canSend) return;
              if (listening) stopListening();
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between px-1 pb-1">
          <div className="flex items-center gap-0.5">
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
              aria-label={t(locale, "addFile")}
              disabled={streaming || disabled}
              onClick={() => {
                inputRef.current?.click();
                onPickFiles();
              }}
            >
              <Plus className="size-5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={listening ? "secondary" : "ghost"}
              className={cn("rounded-full", listening && "text-primary")}
              aria-label={listening ? t(locale, "stopVoice") : t(locale, "voiceInput")}
              aria-pressed={listening}
              disabled={streaming || disabled}
              onClick={() => {
                if (listening) stopListening();
                else startListening();
              }}
            >
              <Mic className={cn("size-5", listening && "animate-pulse")} />
            </Button>
          </div>
          {streaming ? (
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={onStop}
              aria-label={t(locale, "stopGenerating")}
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={() => {
                if (listening) stopListening();
                onSend();
              }}
              disabled={disabled || !canSend}
              aria-label={t(locale, "send")}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {listening ? t(locale, "listeningHint") : t(locale, "disclaimer")}
      </p>
    </div>
  );
}
