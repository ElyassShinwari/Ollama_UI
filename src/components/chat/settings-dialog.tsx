import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CloudConnect } from "@/components/chat/cloud-connect";
import { applyTheme } from "@/lib/theme";
import { applyLocale, LOCALES, t, type LocaleId } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import { syncStudio } from "@/lib/studio/store";
import type { ThemeMode } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function SettingsDialog({
  open,
  onOpenChange,
  onHostChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHostChange?: () => void;
}) {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const locale = settings.locale;
  const [host, setHost] = useState(settings.ollamaHost);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme);
  const [lang, setLang] = useState<LocaleId>(settings.locale);

  useEffect(() => {
    if (!open) return;
    const s = useChatStore.getState().settings;
    setHost(s.ollamaHost);
    setTemperature(String(s.temperature));
    setSystemPrompt(s.systemPrompt);
    setTheme(s.theme);
    setLang(s.locale);
  }, [open]);

  const themes: { id: ThemeMode; label: string }[] = [
    { id: "light", label: t(lang, "light") },
    { id: "dark", label: t(lang, "dark") },
    { id: "system", label: t(lang, "system") },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setHost(settings.ollamaHost);
          setTemperature(String(settings.temperature));
          setSystemPrompt(settings.systemPrompt);
          setTheme(settings.theme);
          setLang(settings.locale);
        } else {
          applyTheme(settings.theme);
          applyLocale(settings.locale);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(lang, "settings")}</DialogTitle>
          <DialogDescription>{t(lang, "settingsLead")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t(lang, "language")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOCALES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={lang === item.id ? "secondary" : "outline"}
                  className={cn("h-10 justify-start", lang === item.id && "ring-1 ring-ring/40")}
                  onClick={() => {
                    setLang(item.id);
                    applyLocale(item.id);
                    setSettings({ locale: item.id });
                  }}
                >
                  <span className="truncate" dir={item.dir} lang={item.htmlLang}>
                    {item.native}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t(lang, "languageHint")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t(lang, "appearance")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={theme === item.id ? "secondary" : "outline"}
                  className={cn("h-10", theme === item.id && "ring-1 ring-ring/40")}
                  onClick={() => {
                    setTheme(item.id);
                    applyTheme(item.id);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ollama-host">{t(lang, "ollamaHost")}</Label>
            <Input
              id="ollama-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t(lang, "ollamaHostHint")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="temperature">
              {t(lang, "temperature")} · {temperature}
            </Label>
            <input
              id="temperature"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={Number(temperature) || 0}
              onChange={(e) => setTemperature(e.target.value)}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t(lang, "cloudAccounts")}</Label>
            <CloudConnect compact />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="system-prompt">{t(lang, "systemPrompt")}</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t(lang, "systemPromptPh")}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              applyTheme(settings.theme);
              applyLocale(settings.locale);
              onOpenChange(false);
            }}
          >
            {t(lang, "cancel")}
          </Button>
          <Button
            onClick={() => {
              const parsed = Number(temperature);
              const nextHost = host.trim() || "http://127.0.0.1:11434";
              setSettings({
                ollamaHost: nextHost,
                temperature: Number.isFinite(parsed) ? parsed : 0.7,
                systemPrompt,
                theme,
                locale: lang,
              });
              applyTheme(theme);
              applyLocale(lang);
              void syncStudio({ ollamaHost: nextHost });
              onOpenChange(false);
              onHostChange?.();
            }}
          >
            {t(lang, "save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
