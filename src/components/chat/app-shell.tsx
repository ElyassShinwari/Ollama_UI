import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatView } from "@/components/chat/chat-view";
import { ConnectScreen } from "@/components/chat/connect-screen";
import { ModelHub } from "@/components/chat/model-hub";
import { StudioPanel } from "@/components/studio/studio-panel";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { FlameMark, Sidebar } from "@/components/chat/sidebar";
import { fetchCatalog, resetModelContext } from "@/lib/llm/catalog";
import { cloudSecret } from "@/lib/llm/cloud";
import { applyTheme, resolvedTheme } from "@/lib/theme";
import { useChatStore } from "@/lib/chat/store";
import { syncStudio } from "@/lib/studio/store";
import type { ModelCatalog, ModelRef } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const emptyCatalog: ModelCatalog = {
  models: [],
  status: {
    loading: true,
    ollamaBrowser: false,
    ollamaServer: false,
    xai: false,
    openai: false,
    anthropic: false,
    kimi: false,
    deepseek: false,
  },
};

export function ChatApp() {
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);
  const newChat = useChatStore((s) => s.newChat);
  const resetUsage = useChatStore((s) => s.resetUsage);
  const [catalog, setCatalog] = useState<ModelCatalog>(emptyCatalog);
  const [browserModels, setBrowserModels] = useState<ModelRef[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [hydrated, setHydrated] = useState(() => useChatStore.persist.hasHydrated());

  const refresh = useCallback(async (localModels = browserModels) => {
    setCatalog((c) =>
      c.models.length > 0 ? c : { ...c, status: { ...c.status, loading: true } },
    );
    const s = useChatStore.getState().settings;
    const next = await fetchCatalog(s.ollamaHost, localModels, {
      openai: cloudSecret(s, "openai"),
      anthropic: cloudSecret(s, "anthropic"),
      xai: cloudSecret(s, "xai"),
      kimi: cloudSecret(s, "kimi"),
      deepseek: cloudSecret(s, "deepseek"),
    });
    setCatalog(next);
    const current = useChatStore.getState().selectedModel;
    if (current) {
      const match = next.models.find(
        (m) => m.id === current.id && m.provider === current.provider,
      );
      if (match) setSelectedModel(match);
    }
    return next.models;
  }, [browserModels, setSelectedModel]);

  useEffect(() => {
    const unsub = useChatStore.persist.onFinishHydration(() => setHydrated(true));
    if (useChatStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings.theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(useChatStore.getState().settings.theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [hydrated, settings.theme]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(id);
  }, [refresh, settings.ollamaHost, settings.openaiKey, settings.anthropicKey, settings.xaiKey, settings.kimiKey, settings.deepseekKey, settings.openaiOAuth, settings.xaiOAuth, settings.kimiOAuth, hydrated]);

  function startFreshChat() {
    const id = newChat();
    resetUsage(id);
    const model = useChatStore.getState().selectedModel;
    if (model) {
      void resetModelContext(useChatStore.getState().settings.ollamaHost, model);
    }
    setMobileOpen(false);
    setStudioOpen(false);
  }

  function chooseModel(model: ModelRef) {
    setSelectedModel(model);
    const state = useChatStore.getState();
    if (!state.activeId) state.newChat();
    setHubOpen(false);
  }

  const sidebar = (
    <Sidebar
      className="h-full w-full"
      onNewChat={startFreshChat}
      onOpenSettings={() => {
        setSettingsOpen(true);
        setMobileOpen(false);
      }}
      onOpenStudio={() => {
        setStudioOpen(true);
        setMobileOpen(false);
      }}
      onNavigate={() => {
        setMobileOpen(false);
        setStudioOpen(false);
      }}
    />
  );

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-foreground">
        <FlameMark className="size-10" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <div
          className={cn(
            "hidden h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out md:block",
            sidebarCollapsed ? "w-0 border-r-0" : "w-72",
          )}
        >
          <div className="h-full w-72">{sidebar}</div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Conversations</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          {studioOpen ? (
            <StudioPanel
              models={catalog.models}
              onClose={() => setStudioOpen(false)}
              onOpenSidebar={() => setMobileOpen(true)}
            />
          ) : selectedModel ? (
            <ChatView
              models={catalog.models}
              onOpenSidebar={() => setMobileOpen(true)}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onNewChat={startFreshChat}
              onBrowseModels={() => setHubOpen(true)}
            />
          ) : (
            <ConnectScreen
              catalog={catalog}
              host={settings.ollamaHost}
              onHostCommit={(host) => {
                setSettings({ ollamaHost: host });
                void syncStudio({ ollamaHost: host });
              }}
              onRefresh={() => refresh()}
              onChoose={chooseModel}
            />
          )}
        </main>
      </div>
      <Dialog open={hubOpen} onOpenChange={setHubOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Install a model</DialogTitle>
          </DialogHeader>
          <ModelHub
            host={settings.ollamaHost}
            localModels={catalog.models.filter((m) => m.provider === "ollama")}
            onChoose={chooseModel}
            onRefreshLocal={() => refresh()}
          />
        </DialogContent>
      </Dialog>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onHostChange={() => void refresh()}
      />
      <Toaster theme={resolvedTheme(settings.theme)} position="top-center" />
    </TooltipProvider>
  );
}
