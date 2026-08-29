import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";

function exact(n: number) {
  return Math.max(0, Math.round(n)).toLocaleString();
}

export function ContextMeter({
  used,
  limit,
}: {
  used: number;
  limit?: number;
}) {
  const locale = useChatStore((s) => s.settings.locale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (ref.current && node && !ref.current.contains(node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!limit || limit <= 0) {
    return (
      <div className="hidden px-2 text-right text-xs text-muted-foreground md:block">
        {used > 0 ? `${exact(used)} tok` : `${t(locale, "contextLabel")} —`}
      </div>
    );
  }
  const ratio = Math.min(1, used / limit);
  const pct = Math.round(ratio * 100);
  const full = ratio >= 1;
  const warn = ratio >= 0.85;
  const title = `${exact(used)} of ${exact(limit)} tokens`;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-xs tabular-nums md:hidden",
          full ? "text-destructive" : warn ? "text-foreground" : "text-muted-foreground",
        )}
        title={title}
        aria-label={title}
        onClick={() => setOpen((v) => !v)}
      >
        {pct}%
      </button>
      {open ? (
        <div className="absolute end-0 top-full z-30 mt-1 w-40 rounded-lg border border-border bg-card px-2 py-2 shadow-[var(--composer-shadow)] md:hidden">
          <MeterBody used={used} limit={limit} ratio={ratio} full={full} warn={warn} />
        </div>
      ) : null}
      <div className="hidden md:block">
        <MeterBody used={used} limit={limit} ratio={ratio} full={full} warn={warn} />
      </div>
    </div>
  );
}

function MeterBody({
  used,
  limit,
  ratio,
  full,
  warn,
}: {
  used: number;
  limit: number;
  ratio: number;
  full: boolean;
  warn: boolean;
}) {
  return (
    <div
      className="flex min-w-28 flex-col items-end gap-1 px-2"
      title={`${exact(used)} of ${exact(limit)} tokens in this chat`}
    >
      <p
        className={cn(
          "font-mono text-[11px] leading-none tabular-nums",
          full ? "text-destructive" : warn ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {exact(used)} / {exact(limit)}
      </p>
      <span className="h-1 w-28 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn(
            "block h-full rounded-full",
            full ? "bg-destructive" : warn ? "bg-primary" : "bg-subtle",
          )}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }}
        />
      </span>
    </div>
  );
}
