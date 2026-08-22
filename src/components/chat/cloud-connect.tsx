import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLOUD_ACCOUNTS } from "@/lib/llm/cloud";
import { useChatStore } from "@/lib/chat/store";
import type { Settings } from "@/lib/chat/types";

function keysFrom(settings: Settings) {
  return {
    openaiKey: settings.openaiKey,
    anthropicKey: settings.anthropicKey,
    xaiKey: settings.xaiKey,
    kimiKey: settings.kimiKey,
    deepseekKey: settings.deepseekKey,
  };
}

export function CloudConnect({ compact = false }: { compact?: boolean }) {
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const [draft, setDraft] = useState(() => keysFrom(settings));

  function setField(setting: keyof typeof draft, value: string) {
    setDraft((cur) => ({ ...cur, [setting]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        Sign in on ChatGPT, Claude, Grok, Kimi, or DeepSeek, then paste an API key or access token
        from that account. These sites do not hand this app your web-chat login by themselves — the
        key or token is what gets sent.
      </p>
      {CLOUD_ACCOUNTS.map((account) => {
        const setting = account.setting as keyof typeof draft;
        return (
          <div key={account.id} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>{account.label}</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(account.login, "_blank", "noopener,noreferrer")}
                >
                  Sign in
                </Button>
                {!compact ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(account.keys, "_blank", "noopener,noreferrer")}
                  >
                    API key
                  </Button>
                ) : null}
              </div>
            </div>
            <Input
              type="password"
              value={draft[setting]}
              onChange={(e) => setField(setting, e.target.value)}
              placeholder="API key or access token"
              autoComplete="off"
            />
          </div>
        );
      })}
      <Button
        onClick={() => {
          setSettings({
            openaiKey: draft.openaiKey.trim(),
            anthropicKey: draft.anthropicKey.trim(),
            xaiKey: draft.xaiKey.trim(),
            kimiKey: draft.kimiKey.trim(),
            deepseekKey: draft.deepseekKey.trim(),
          });
          toast.success("Accounts saved. Those models appear in the same menu as Ollama.");
        }}
      >
        Save accounts
      </Button>
    </div>
  );
}
