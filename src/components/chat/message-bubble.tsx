import { Check, ChevronLeft, ChevronRight, Copy, Pencil, RotateCcw } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageMarkdown, StreamingMarkdown } from "@/components/chat/markdown";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import type { Message } from "@/lib/chat/types";

export const MessageBubble = memo(function MessageBubble({
  message,
  streaming,
  showRegen,
  onRegenerate,
  onRetry,
  onEdit,
  versionIndex,
  versionCount,
  prevId,
  nextId,
  onSelectSibling,
}: {
  message: Message;
  streaming?: boolean;
  showRegen?: boolean;
  onRegenerate?: () => void;
  onRetry?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  versionIndex?: number;
  versionCount?: number;
  prevId?: string;
  nextId?: string;
  onSelectSibling?: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const locale = useChatStore((s) => s.settings.locale);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const versions = (versionCount ?? 1) > 1;

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const pager = versions ? (
    <div className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t(locale, "prevVersion")}
        disabled={!prevId}
        onClick={() => prevId && onSelectSibling?.(prevId)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-9 text-center">
        {versionIndex}/{versionCount}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t(locale, "nextVersion")}
        disabled={!nextId}
        onClick={() => nextId && onSelectSibling?.(nextId)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  ) : null;

  if (isUser) {
    return (
      <div className="group flex flex-col items-end gap-1.5">
        {editing ? (
          <div className="w-full max-w-[min(100%,42rem)] rounded-3xl bg-secondary p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(10, Math.max(3, draft.split("\n").length))}
              className="min-h-20 bg-transparent"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
              >
                {t(locale, "cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!draft.trim()}
                onClick={() => {
                  const next = draft.trim();
                  if (!next) return;
                  setEditing(false);
                  onEdit?.(message.id, next);
                }}
              >
                {t(locale, "save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-[min(100%,42rem)] rounded-3xl bg-secondary px-5 py-3 text-[15px] leading-7 break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
            {message.attachments?.length ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {message.attachments.map((file) => (
                  <span
                    key={file.name}
                    className="rounded-lg bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
            {message.images?.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {message.images.map((src, i) => (
                  <img
                    key={i}
                    src={src.startsWith("data:") || src.startsWith("blob:") ? src : `data:image/png;base64,${src}`}
                    alt=""
                    className="max-h-40 rounded-xl"
                  />
                ))}
              </div>
            ) : null}
            {message.content}
          </div>
        )}
        {!editing && !streaming ? (
          <div
            className={cn(
              "flex items-center gap-0.5",
              versions ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
            )}
          >
            {pager}
            <Button size="icon-sm" variant="ghost" aria-label={t(locale, "copy")} onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t(locale, "edit")}
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            {onRetry ? (
              <Button size="icon-sm" variant="ghost" aria-label={t(locale, "retry")} onClick={() => onRetry(message.id)}>
                <RotateCcw className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-2">
      <div className="flex gap-3">
        <div
          className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="size-4">
            <path
              fill="currentColor"
              d="M12 4.5c2.7 3.4 4.8 5.6 4.8 8.4A4.8 4.8 0 1 1 7.2 12.9c0-2.8 2.1-5 4.8-8.4z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-7 break-words [overflow-wrap:anywhere]">
          {message.modelName ? (
            <p className="mb-1 text-xs text-muted-foreground">{message.modelName}</p>
          ) : null}
          {message.content ? (
            streaming ? (
              <StreamingMarkdown content={message.content} />
            ) : (
              <MessageMarkdown content={message.content} />
            )
          ) : streaming ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-foreground" />
              {t(locale, "thinking")}
            </span>
          ) : (
            <span className="text-muted-foreground">{t(locale, "noReply")}</span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "ms-10 flex items-center gap-0.5",
          streaming
            ? "opacity-0"
            : versions
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        )}
      >
        {pager}
        <Button size="icon-sm" variant="ghost" aria-label={t(locale, "copy")} onClick={() => void copy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
        {showRegen && onRegenerate ? (
          <Button size="icon-sm" variant="ghost" aria-label={t(locale, "retry")} onClick={onRegenerate}>
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
});
