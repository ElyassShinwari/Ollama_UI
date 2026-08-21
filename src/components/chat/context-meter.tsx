import { cn } from "@/lib/utils";

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
  if (!limit || limit <= 0) {
    return (
      <div className="px-2 text-right text-xs text-muted-foreground">
        {used > 0 ? `${exact(used)} tok` : "Context —"}
      </div>
    );
  }
  const ratio = Math.min(1, used / limit);
  const full = ratio >= 1;
  const warn = ratio >= 0.85;
  return (
    <div
      className="flex min-w-36 flex-col items-end gap-1 px-2"
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
