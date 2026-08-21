import { cn, formatTokenCount } from "@/lib/utils";

export function ContextMeter({
  used,
  limit,
}: {
  used: number;
  limit?: number;
}) {
  if (!limit || limit <= 0) {
    return (
      <div className="px-2 text-right text-xs text-muted-foreground">
        Context —
      </div>
    );
  }
  const ratio = Math.min(1, used / limit);
  const full = ratio >= 1;
  const warn = ratio >= 0.85;
  return (
    <div
      className="flex min-w-32 flex-col items-end gap-1 px-2"
      title={`${Math.round(used)} of ${limit} tokens used`}
    >
      <p
        className={cn(
          "font-mono text-[11px] leading-none",
          full ? "text-destructive" : warn ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {formatTokenCount(used)} / {formatTokenCount(limit)}
      </p>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn(
            "block h-full rounded-full",
            full ? "bg-destructive" : warn ? "bg-primary" : "bg-subtle",
          )}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 4 : 0)}%` }}
        />
      </span>
    </div>
  );
}
