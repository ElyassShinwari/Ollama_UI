import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
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
import { OllamaLaunch, ollamaIsUp } from "@/components/chat/ollama-launch";
import { StudioPanel, type StudioTab } from "@/components/studio/studio-panel";
import { NewsPanel } from "@/components/news/news-panel";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { FlameMark, Sidebar } from "@/components/chat/sidebar";
import { fetchCatalog, fillOllamaContext, probeBrowserOllama } from "@/lib/llm/catalog";
import { ollamaGate } from "@/lib/llm/ollama-client";
import { cloudSecret } from "@/lib/llm/cloud";
import { applyTheme, resolvedTheme } from "@/lib/theme";
import { applyLocale, localeInfo, t } from "@/lib/i18n";
import { useAppViewport } from "@/lib/viewport";
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
  useAppViewport();
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const settings = useChatStore((s) => s.settings);
  const setSettings = useChatStore((s) => s.setSettings);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);
  const newChat = useChatStore((s) => s.newChat);
  const resetUsage = useChatStore((s) => s.resetUsage);
  const [catalog, setCatalog] = useState<ModelCatalog>(emptyCatalog);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubQuery, setHubQuery] = useState("");
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>("n8n");
  const [newsOpen, setNewsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(() => useChatStore.persist.hasHydrated());
  const overlayPushed = useRef(false);

  const refresh = useCallback(async () => {
    if (ollamaGate.chat) return;
    setCatalog((c) =>
      c.models.length > 0 ? c : { ...c, status: { ...c.status, loading: true } },
    );
    const s = useChatStore.getState().settings;
    const local = await probeBrowserOllama(s.ollamaHost);
    const next = await fetchCatalog(s.ollamaHost, local, {
      openai: cloudSecret(s, "openai"),
      anthropic: cloudSecret(s, "anthropic"),
      xai: cloudSecret(s, "xai"),
      kimi: cloudSecret(s, "kimi"),
      deepseek: cloudSecret(s, "deepseek"),
    });
    if (ollamaGate.chat) return next.models;
    setCatalog(next);
    const current = useChatStore.getState().selectedModel;
    if (current) {
      const match = next.models.find(
        (m) => m.id === current.id && m.provider === current.provider,
      );
      if (match) setSelectedModel(match);
    }
    return next.models;
  }, [setSelectedModel]);

  useEffect(() => {
    if (!hydrated || !selectedModel || selectedModel.provider !== "ollama") return;
    if (ollamaGate.chat) return;
    let cancelled = false;
    void fillOllamaContext(settings.ollamaHost, selectedModel).then((next) => {
      if (cancelled || ollamaGate.chat) return;
      if (next.contextLength && next.contextLength !== selectedModel.contextLength) {
        setSelectedModel(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, selectedModel, settings.ollamaHost, setSelectedModel]);

  useEffect(() => {
    const unsub = useChatStore.persist.onFinishHydration(() => setHydrated(true));
    if (useChatStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings.theme);
    applyLocale(settings.locale);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(useChatStore.getState().settings.theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [hydrated, settings.theme, settings.locale]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
    const id = window.setInterval(() => {
      if (ollamaGate.chat) return;
      void refresh();
    }, 60000);
    return () => window.clearInterval(id);
  }, [refresh, settings.ollamaHost, settings.openaiKey, settings.anthropicKey, settings.xaiKey, settings.kimiKey, settings.deepseekKey, settings.openaiOAuth, settings.xaiOAuth, settings.kimiOAuth, hydrated]);

  function closeOverlay(opts?: { fromPop?: boolean }) {
    setStudioOpen(false);
    setNewsOpen(false);
    setHubOpen(false);
    if (!opts?.fromPop && overlayPushed.current) {
      overlayPushed.current = false;
      if (window.history.state && (window.history.state as { ollamaUiOverlay?: string }).ollamaUiOverlay) {
        window.history.back();
      }
    } else {
      overlayPushed.current = false;
    }
  }

  function openStudio(tab: StudioTab = "n8n") {
    setStudioTab(tab);
    setStudioOpen(true);
    setNewsOpen(false);
    setMobileOpen(false);
  }

  function openNews() {
    setNewsOpen(true);
    setStudioOpen(false);
    setMobileOpen(false);
  }

  function startFreshChat() {
    const id = newChat();
    resetUsage(id);
    setMobileOpen(false);
    closeOverlay();
  }

  function chooseModel(model: ModelRef) {
    setSelectedModel(model);
    const state = useChatStore.getState();
    if (!state.activeId) state.newChat();
    setHubOpen(false);
  }

  // Browser / phone back closes News, Studio, or Models instead of leaving the app.
  useEffect(() => {
    const open = studioOpen || newsOpen || hubOpen;
    if (!open) return;
    const key = studioOpen ? "studio" : newsOpen ? "news" : "hub";
    if (!overlayPushed.current || (window.history.state as { ollamaUiOverlay?: string } | null)?.ollamaUiOverlay !== key) {
      window.history.pushState({ ollamaUiOverlay: key }, "");
      overlayPushed.current = true;
    }
    const onPop = () => {
      overlayPushed.current = false;
      setStudioOpen(false);
      setNewsOpen(false);
      setHubOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [studioOpen, newsOpen, hubOpen]);

  const sidebar = (
    <Sidebar
      className="h-full w-full"
      onNewChat={startFreshChat}
      onOpenSettings={() => {
        setSettingsOpen(true);
        setMobileOpen(false);
      }}
      onOpenStudio={() => openStudio("GitHub")}
      onOpenN8n={() => openStudio("n8n")}
      onOpenNews={openNews}
      newsActive={newsOpen}
      studioActive={studioOpen}
      n8nActive={studioOpen && studioTab === "n8n"}
      onNavigate={() => {
        setMobileOpen(false);
        closeOverlay();
      }}
    />
  );

  if (!hydrated) {
    return (
      <div className="flex h-app items-center justify-center bg-background text-foreground">
        <FlameMark className="size-10" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-app overflow-hidden bg-background text-foreground">
        <div
          className={cn(
            "hidden h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out md:block",
            sidebarCollapsed ? "w-0 border-r-0" : "w-72",
          )}
        >
          <div className="h-full w-72">{sidebar}</div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side={localeInfo(settings.locale).dir === "rtl" ? "right" : "left"} hideClose className="p-0">
            <SheetTitle className="sr-only">{t(settings.locale, "conversations")}</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          {studioOpen ? (
            <StudioPanel
              models={catalog.models}
              onClose={() => closeOverlay()}
              onOpenSidebar={() => setMobileOpen(true)}
              initialTab={studioTab}
            />
          ) : newsOpen ? (
            <NewsPanel
              onClose={() => closeOverlay()}
              onOpenSidebar={() => setMobileOpen(true)}
            />
          ) : selectedModel && selectedModel.provider === "ollama" && !catalog.status.loading && !ollamaIsUp(catalog.status) ? (
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex h-14 shrink-0 items-center px-2 md:hidden">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
                  onClick={() => setMobileOpen(true)}
                  aria-label={t(settings.locale, "openSidebar")}
                >
                  <Menu className="size-5" />
                </button>
              </header>
              <OllamaLaunch
                host={settings.ollamaHost}
                variant="page"
                onReady={() => refresh()}
              />
            </div>
          ) : selectedModel ? (
            <ChatView
              models={catalog.models}
              onOpenSidebar={() => setMobileOpen(true)}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onNewChat={startFreshChat}
              onBrowseModels={(query) => {
                setHubQuery(query ?? "");
                setHubOpen(true);
              }}
              onRefreshModels={() => refresh()}
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
              onOpenSidebar={() => setMobileOpen(true)}
            />
          )}
        </main>
      </div>
      <Dialog
        open={hubOpen}
        onOpenChange={(open) => {
          if (open) {
            setHubOpen(true);
            return;
          }
          setHubQuery("");
          closeOverlay();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(settings.locale, "modelsTitle")}</DialogTitle>
          </DialogHeader>
          <ModelHub
            host={settings.ollamaHost}
            localModels={catalog.models.filter((m) => m.provider === "ollama")}
            onChoose={chooseModel}
            onRefreshLocal={() => refresh()}
            initialQuery={hubQuery}
          />
        </DialogContent>
      </Dialog>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onHostChange={() => void refresh()}
        onOpenN8n={() => {
          setSettingsOpen(false);
          openStudio("n8n");
        }}
      />
      <Toaster theme={resolvedTheme(settings.theme)} position="top-center" />
    </TooltipProvider>
  );
}
