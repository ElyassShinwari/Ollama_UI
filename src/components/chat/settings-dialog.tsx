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
import { useChatStore } from "@/lib/chat/store";
import { syncStudio } from "@/lib/studio/store";
import type { ThemeMode } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

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
  const [host, setHost] = useState(settings.ollamaHost);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme);

  useEffect(() => {
    if (!open) return;
    const s = useChatStore.getState().settings;
    setHost(s.ollamaHost);
    setTemperature(String(s.temperature));
    setSystemPrompt(s.systemPrompt);
    setTheme(s.theme);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setHost(settings.ollamaHost);
          setTemperature(String(settings.temperature));
          setSystemPrompt(settings.systemPrompt);
          setTheme(settings.theme);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Point Ollama UI at Ollama and tune how replies feel.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Appearance</Label>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((item) => (
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
            <Label htmlFor="ollama-host">Ollama host</Label>
            <Input
              id="ollama-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Ollama UI lists every model already downloaded there, then lets you switch mid-chat.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="temperature">Temperature · {temperature}</Label>
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
            <Label>Cloud accounts</Label>
            <CloudConnect compact />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="system-prompt">System prompt</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional instructions for every reply"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              applyTheme(settings.theme);
              onOpenChange(false);
            }}
          >
            Cancel
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
              });
              applyTheme(theme);
              void syncStudio({ ollamaHost: nextHost });
              onOpenChange(false);
              onHostChange?.();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
