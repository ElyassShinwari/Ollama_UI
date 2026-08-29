import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyLocale, localeInfo, LOCALES, t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (ref.current && node && !ref.current.contains(node)) onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

function pickLocale(id: (typeof LOCALES)[number]["id"]) {
  useChatStore.getState().setSettings({ locale: id });
  applyLocale(id);
}

export function LanguageList({ onPicked }: { onPicked?: () => void }) {
  const locale = useChatStore((s) => s.settings.locale);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {LOCALES.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant={item.id === locale ? "secondary" : "outline"}
          className={cn("h-9 justify-start", item.id === locale && "ring-1 ring-ring/40")}
          onClick={() => {
            pickLocale(item.id);
            onPicked?.();
          }}
        >
          <span className="min-w-0 flex-1 truncate text-left" dir={item.dir} lang={item.htmlLang}>
            {item.native}
          </span>
          {item.id === locale ? <Check className="size-3.5 shrink-0" /> : null}
        </Button>
      ))}
    </div>
  );
}

export function LanguagePicker({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "header";
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useDismiss(open, close);
  const locale = useChatStore((s) => s.settings.locale);
  const current = localeInfo(locale);

  return (
    <div ref={ref} className={cn("relative", variant === "sidebar" && "w-full")}>
      <Button
        type="button"
        variant={variant === "header" ? "outline" : "ghost"}
        size={variant === "header" ? "icon" : "default"}
        className={cn(
          variant === "header"
            ? "size-10 shrink-0 gap-0 rounded-full px-0 md:h-8 md:w-auto md:gap-1.5 md:px-2.5"
            : "h-10 w-full justify-start gap-2",
        )}
        aria-expanded={open}
        aria-label={t(locale, "language")}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe className="size-4 shrink-0" />
        <span className={cn("min-w-0 truncate", variant === "header" && "hidden md:inline")}>
          {t(locale, "language")}
        </span>
        <span
          className={cn(
            "max-w-[7rem] truncate text-xs text-muted-foreground",
            variant === "header" && "hidden md:inline",
          )}
          dir={current.dir}
          lang={current.htmlLang}
        >
          {current.native}
        </span>
      </Button>
      {open ? (
        <div
          className={cn(
            "z-[80] rounded-xl border border-border bg-card p-2 shadow-[var(--composer-shadow)]",
            variant === "header"
              ? "absolute end-0 top-full mt-1 w-[min(20rem,calc(100vw-1.5rem))]"
              : "absolute start-0 bottom-full mb-1 w-full",
          )}
        >
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{t(locale, "language")}</p>
          <LanguageList onPicked={close} />
        </div>
      ) : null}
    </div>
  );
}
