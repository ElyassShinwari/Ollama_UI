import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlameMark } from "@/components/chat/sidebar";
import { ModelHub } from "@/components/chat/model-hub";
import { CLOUD_LABEL } from "@/lib/llm/cloud";
import { t } from "@/lib/i18n";
import { useChatStore } from "@/lib/chat/store";
import type { ModelCatalog, ModelRef, Provider } from "@/lib/chat/types";

export function ConnectScreen({
  catalog,
  host,
  onHostCommit,
  onRefresh,
  onChoose,
  onOpenSidebar,
}: {
  catalog: ModelCatalog;
  host: string;
  onHostCommit: (host: string) => void;
  onRefresh: () => Promise<ModelRef[] | void> | void;
  onChoose: (model: ModelRef) => void;
  onOpenSidebar?: () => void;
}) {
  const [hostDraft, setHostDraft] = useState(host);
  const [query, setQuery] = useState("");
  const locale = useChatStore((s) => s.settings.locale);

  useEffect(() => {
    setHostDraft(host);
  }, [host]);
  const q = query.trim().toLowerCase();
  const ollama = catalog.models.filter((m) => m.provider === "ollama");
  const cloudGroups: { title: string; items: ModelRef[] }[] = (
    ["openai", "anthropic", "xai", "kimi", "deepseek"] as Exclude<Provider, "ollama">[]
  )
    .map((provider) => ({
      title: CLOUD_LABEL[provider],
      items: catalog.models.filter((m) => {
        if (m.provider !== provider) return false;
        if (!q) return true;
        return `${m.name} ${m.id} ${provider}`.toLowerCase().includes(q);
      }),
    }))
    .filter((g) => g.items.length > 0);
  const hasCloud = catalog.models.some((m) => m.provider !== "ollama");

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-10 md:py-14">
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-2">
            {onOpenSidebar ? (
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                onClick={onOpenSidebar}
                aria-label={t(locale, "openSidebar")}
              >
                <Menu className="size-5" />
              </Button>
            ) : null}
            <FlameMark className="size-10" />
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-balance md:text-5xl">
            {hasCloud ? t(locale, "chooseModel") : t(locale, "chooseLocalModel")}
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground text-pretty">
            {hasCloud ? t(locale, "connectCloud") : t(locale, "connectLocal")}
          </p>
        </div>

        {hasCloud ? (
          <div className="mb-8 flex flex-col gap-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(locale, "searchCloud")}
              autoComplete="off"
            />
            {cloudGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cloud model matches that search.</p>
            ) : (
              cloudGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-sm font-medium">{group.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map((model) => (
                      <button
                        key={`${model.provider}:${model.id}`}
                        type="button"
                        className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => onChoose(model)}
                      >
                        <span className="block truncate font-medium">{model.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        <ModelHub
          host={host}
          localModels={ollama}
          onChoose={onChoose}
          onRefreshLocal={async () => {
            const result = await onRefresh();
            return result;
          }}
        />

        <form
          className="mt-8 flex flex-col gap-2 border-t border-border pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            onHostCommit(hostDraft.trim() || "http://127.0.0.1:11434");
          }}
        >
          <label htmlFor="connect-host" className="text-sm font-medium">
            Ollama host
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="connect-host"
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              placeholder="http://127.0.0.1:11434"
            />
            <Button type="submit" variant="secondary">
              Look there
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
