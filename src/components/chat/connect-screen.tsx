import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlameMark } from "@/components/chat/sidebar";
import { ModelHub } from "@/components/chat/model-hub";
import type { ModelCatalog, ModelRef } from "@/lib/chat/types";

export function ConnectScreen({
  catalog,
  host,
  onHostCommit,
  onRefresh,
  onChoose,
}: {
  catalog: ModelCatalog;
  host: string;
  onHostCommit: (host: string) => void;
  onRefresh: () => Promise<ModelRef[] | void> | void;
  onChoose: (model: ModelRef) => void;
}) {
  const [hostDraft, setHostDraft] = useState(host);
  const ollama = catalog.models.filter((m) => m.provider === "ollama");

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-10 md:py-14">
        <div className="mb-8">
          <FlameMark className="mb-5 size-10" />
          <h1 className="font-serif text-4xl tracking-tight text-balance md:text-5xl">
            Choose a local model
          </h1>
          <p className="mt-3 max-w-lg text-base text-muted-foreground text-pretty">
            Install Ollama if needed, then search the library and install a model with one click.
            Switch models anytime from the chat header.
          </p>
        </div>

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
