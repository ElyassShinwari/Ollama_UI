import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyLocale, localeInfo, LOCALES, t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function LanguagePicker({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "icon";
}) {
  const locale = useChatStore((s) => s.settings.locale);
  const setSettings = useChatStore((s) => s.setSettings);
  const current = localeInfo(locale);

  function pick(id: (typeof LOCALES)[number]["id"]) {
    setSettings({ locale: id });
    applyLocale(id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="rounded-full"
            aria-label={t(locale, "language")}
            title={`${t(locale, "language")}: ${current.native}`}
          >
            <Globe className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" className="h-10 w-full justify-start gap-2">
            <Globe className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{t(locale, "language")}</span>
            <span
              className="ms-auto max-w-[7rem] truncate text-xs text-muted-foreground"
              dir={current.dir}
              lang={current.htmlLang}
            >
              {current.native}
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "icon" ? "end" : "start"} className="w-64">
        <DropdownMenuLabel>{t(locale, "language")}</DropdownMenuLabel>
        {LOCALES.map((item) => (
          <DropdownMenuItem
            key={item.id}
            className={cn(item.id === locale && "bg-accent")}
            onSelect={() => pick(item.id)}
          >
            <span className="min-w-0 flex-1 truncate" dir={item.dir} lang={item.htmlLang}>
              {item.native}
            </span>
            <span className="text-xs text-muted-foreground">{item.name}</span>
            {item.id === locale ? <Check className="size-4" /> : <span className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
