import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TASK_ADVICE, adviceForModel, modelCanFineTune, modelSupportsTools } from "@/lib/studio/advisor";
import { randomKey, syncStudio, useStudio } from "@/lib/studio/store";
import type { McpServerConfig } from "@/lib/studio/types";
import { useChatStore } from "@/lib/chat/store";
import type { ModelRef } from "@/lib/chat/types";
import { CloudConnect } from "@/components/chat/cloud-connect";
import { cn } from "@/lib/utils";
import { parseRepoUrl } from "@/lib/studio/github";

const TABS = [
  "GitHub",
  "Cloud base",
  "MCP",
  "API",
  "Channels",
  "Instructions",
  "Train",
  "Advisor",
] as const;

type Tab = (typeof TABS)[number];

export function StudioPanel({
  models,
  onClose,
  onOpenSidebar,
}: {
  models: ModelRef[];
  onClose: () => void;
  onOpenSidebar?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("GitHub");
  const selected = useChatStore((s) => s.selectedModel);
  const apiKey = useStudio((s) => s.apiKey);
  const channelSecret = useStudio((s) => s.channelSecret);

  useEffect(() => {
    const patch: { apiKey?: string; channelSecret?: string; ollamaHost?: string } = {};
    if (!apiKey) patch.apiKey = randomKey();
    if (!channelSecret) patch.channelSecret = randomKey().slice(0, 24);
    const host = useChatStore.getState().settings.ollamaHost;
    if (host) patch.ollamaHost = host;
    if (Object.keys(patch).length) {
      useStudio.getState().setStudio(patch);
      void syncStudio(patch);
    } else {
      void syncStudio();
    }
  }, [apiKey, channelSecret]);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {onOpenSidebar ? (
              <Button
                size="icon"
                variant="ghost"
                className="mt-1 md:hidden"
                onClick={onOpenSidebar}
                aria-label="Open sidebar"
              >
                <Menu className="size-5" />
              </Button>
            ) : null}
            <div>
              <h1 className="font-serif text-4xl tracking-tight">Studio</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground text-pretty">
                Connect GitHub, MCP servers, a public API, and chatbots. Add instructions and knowledge.
                Ollama does not train models in place — Studio tells you what is possible.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onClose}>
            Back to chat
          </Button>
        </div>
        <div className="mb-6 flex flex-wrap gap-1">
          {TABS.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={tab === item ? "secondary" : "ghost"}
              onClick={() => setTab(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        {tab === "GitHub" ? <GitHubTab /> : null}
        {tab === "Cloud base" ? <CloudTab /> : null}
        {tab === "MCP" ? <McpTab models={models} selected={selected} /> : null}
        {tab === "API" ? <ApiTab models={models} /> : null}
        {tab === "Channels" ? <ChannelsTab models={models} selected={selected} /> : null}
        {tab === "Instructions" ? <InstructionsTab /> : null}
        {tab === "Train" ? <TrainTab selected={selected} /> : null}
        {tab === "Advisor" ? <AdvisorTab selected={selected} /> : null}
      </div>
    </div>
  );
}

function GitHubTab() {
  const token = useStudio((s) => s.githubToken);
  const repos = useStudio((s) => s.repos);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [head, setHead] = useState("");
  const [base, setBase] = useState("main");
  const [prBody, setPrBody] = useState("");

  async function clone() {
    setBusy(true);
    try {
      await syncStudio({ githubToken: token });
      const res = await fetch("/api/github-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, token }),
      });
      const json = (await res.json()) as { error?: string; repos?: typeof repos };
      if (!res.ok) throw new Error(json.error || "Clone failed");
      if (json.repos) useStudio.getState().setStudio({ repos: json.repos });
      toast.success("Repository is on this computer");
      try {
        const parsed = parseRepoUrl(url);
        setOwner(parsed.owner);
        setRepo(parsed.repo);
        if (!head) setHead("main");
      } catch {
        /* keep PR fields as typed */
      }
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Authenticate GitHub</Label>
        <Input
          type="password"
          value={token}
          onChange={(e) => useStudio.getState().setStudio({ githubToken: e.target.value })}
          placeholder="ghp_… or github_pat_…"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await syncStudio({ githubToken: token });
              const res = await fetch("/api/github-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              });
              const json = (await res.json()) as { error?: string; login?: string };
              if (!res.ok) toast.error(json.error || "Auth failed");
              else {
                setLogin(json.login || "");
                if (json.login && !owner) setOwner(json.login);
                toast.success(`Signed in as ${json.login}`);
              }
            }}
            disabled={!token.trim()}
          >
            Authenticate
          </Button>
          {login ? <span className="self-center text-sm text-muted-foreground">@{login}</span> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Create a token at github.com/settings/tokens with repo access. This app does not do GitHub OAuth in the browser.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="owner/repo or https://github.com/owner/repo"
        />
        <Button onClick={() => void clone()} disabled={busy || !url.trim()}>
          Pull repository
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {repos.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.path}</p>
            </div>
            <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                try {
                  const parsed = parseRepoUrl(item.url || item.name);
                  setOwner(parsed.owner);
                  setRepo(parsed.repo);
                } catch {
                  /* ignore */
                }
              }}
            >
              Use for PR
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await fetch("/api/github-pull", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: item.id }),
                });
                const json = (await res.json()) as { error?: string; repos?: typeof repos };
                if (!res.ok) toast.error(json.error || "Pull failed");
                else {
                  if (json.repos) useStudio.getState().setStudio({ repos: json.repos });
                  toast.success("Updated");
                }
              }}
            >
              Pull
            </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border px-4 py-4">
        <p className="mb-3 font-medium">Create a pull request</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner" />
          <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="repo" />
          <Input value={head} onChange={(e) => setHead(e.target.value)} placeholder="head branch" />
          <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="base branch" />
        </div>
        <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PR title" />
        <Textarea className="mt-2" rows={3} value={prBody} onChange={(e) => setPrBody(e.target.value)} placeholder="PR description" />
        <Button
          className="mt-3"
          onClick={async () => {
            const res = await fetch("/api/github-pr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, owner, repo, title, head, base, prBody }),
            });
            const json = (await res.json()) as { error?: string; url?: string };
            if (!res.ok) toast.error(json.error || "PR failed");
            else if (json.url) {
              toast.success("Pull request opened", {
                description: json.url,
                action: {
                  label: "Open",
                  onClick: () => window.open(json.url, "_blank", "noopener,noreferrer"),
                },
              });
            } else toast.success("Pull request opened");
          }}
          disabled={!token || !owner || !repo || !title || !head}
        >
          Open pull request
        </Button>
      </div>
    </div>
  );
}

function CloudTab() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        Sign in here for ChatGPT, Grok, and Kimi. Claude and DeepSeek need an API key after you
        sign in on their site. Signed-in models work in the same menu as Ollama, including Start review.
      </p>
      <CloudConnect />
    </div>
  );
}

function McpTab({ models, selected }: { models: ModelRef[]; selected: ModelRef | null }) {
  const servers = useStudio((s) => s.mcpServers);
  const [name, setName] = useState("local-tools");
  const [command, setCommand] = useState("node");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<McpServerConfig["transport"]>("stdio");
  const [tools, setTools] = useState<string>("");
  const canTools = modelSupportsTools(selected);

  return (
    <div className="flex flex-col gap-4">
      <p className={cn("rounded-xl border px-4 py-3 text-sm", canTools ? "border-border" : "border-destructive/40")}>
        {selected
          ? canTools
            ? `${selected.name} can use MCP tools.`
            : `${selected.name} does not advertise tools. Use qwen2.5, llama3.1, or llama3.2 for MCP.`
          : "Pick a model that supports tools before wiring MCP into chat."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={transport}
          onChange={(e) => setTransport(e.target.value as McpServerConfig["transport"])}
        >
          <option value="stdio">stdio command</option>
          <option value="http">HTTP / SSE URL</option>
        </select>
      </div>
      {transport === "stdio" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Command (node, python, npx)" />
          <Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="Args" />
        </div>
      ) : (
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:3000" />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const server: McpServerConfig = {
              id: crypto.randomUUID(),
              name: name.trim() || "mcp",
              enabled: true,
              transport,
              command,
              args,
              url,
            };
            useStudio.getState().addMcp(server);
            void syncStudio();
          }}
        >
          Connect MCP server
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const res = await fetch("/api/mcp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create", name, description: "Starter echo tool" }),
            });
            const json = (await res.json()) as { error?: string; command?: string; args?: string; dir?: string };
            if (!res.ok) toast.error(json.error || "Create failed");
            else {
              toast.success(`Created ${json.dir}`);
              if (json.args) setArgs(json.args);
              setCommand(json.command || "node");
              setTransport("stdio");
            }
          }}
        >
          Create an MCP server
        </Button>
      </div>
      {servers.map((server) => (
        <div key={server.id} className="rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{server.name}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await syncStudio();
                  const res = await fetch("/api/mcp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: server.id }),
                  });
                  const json = (await res.json()) as { error?: string; tools?: { name: string }[] };
                  if (!res.ok) toast.error(json.error || "Could not list tools");
                  else setTools((json.tools ?? []).map((t) => t.name).join(", ") || "No tools");
                }}
              >
                List tools
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                useStudio.getState().removeMcp(server.id);
                void syncStudio();
              }}>
                Remove
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {server.transport === "stdio" ? `${server.command} ${server.args}` : server.url}
          </p>
        </div>
      ))}
      {tools ? <p className="text-sm text-muted-foreground">Tools: {tools}</p> : null}
      <p className="text-xs text-muted-foreground">
        Models: {models.filter((m) => modelSupportsTools(m)).map((m) => m.name).join(", ") || "none installed yet"}
      </p>
    </div>
  );
}

function localModels(models: ModelRef[]) {
  return models.filter((m) => m.provider === "ollama");
}

function DefaultModelSelect({ models }: { models: ModelRef[] }) {
  const stored = useStudio((s) => s.defaultModel);
  const local = localModels(models);
  const value = local.some((m) => m.id === stored) ? stored : "";
  return (
    <div className="flex flex-col gap-2">
      <Label>Default local model</Label>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        value={value}
        onChange={(e) => {
          useStudio.getState().setStudio({ defaultModel: e.target.value });
          void syncStudio({ defaultModel: e.target.value });
        }}
      >
        <option value="">Choose a local Ollama model…</option>
        {local.map((m) => (
          <option key={`${m.provider}:${m.id}`} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {local.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          The local API and webhooks talk to Ollama on this computer. Install a local model first.
        </p>
      ) : null}
    </div>
  );
}

function ApiTab({ models }: { models: ModelRef[] }) {
  const apiKey = useStudio((s) => s.apiKey);
  const enabled = useStudio((s) => s.apiEnabled);
  const defaultModel = useStudio((s) => s.defaultModel);
  const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8080";
  const curl = useMemo(
    () =>
      `curl ${origin}/api/v1/chat/completions \\\n  -H "Authorization: Bearer ${apiKey || "YOUR_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${defaultModel || "smollm2:135m"}","messages":[{"role":"user","content":"Hello"}]}'`,
    [apiKey, defaultModel, origin],
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            useStudio.getState().setStudio({ apiEnabled: e.target.checked });
            void syncStudio({ apiEnabled: e.target.checked });
          }}
        />
        Enable the local API so other programs can call your model
      </label>
      <DefaultModelSelect models={models} />
      <div className="flex flex-col gap-2">
        <Label>API key</Label>
        <div className="flex gap-2">
          <Input readOnly value={apiKey} />
          <Button
            variant="outline"
            onClick={() => {
              const key = randomKey();
              useStudio.getState().setStudio({ apiKey: key });
              void syncStudio({ apiKey: key });
            }}
          >
            Rotate
          </Button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-secondary p-4 font-mono text-xs leading-5">{curl}</pre>
      <p className="text-sm text-muted-foreground">
        OpenAI-style endpoint: POST /api/v1/chat/completions. Only reachable on this computer unless you tunnel it.
      </p>
    </div>
  );
}

function ChannelsTab({ models, selected }: { models: ModelRef[]; selected: ModelRef | null }) {
  const secret = useStudio((s) => s.channelSecret);
  const verify = useStudio((s) => s.channelVerify);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhook = `${origin}/api/channel?secret=${secret}`;
  const widget = `<script>
fetch("${origin}/api/channel?secret=${secret}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Hello from the website" })
}).then(r => r.json()).then(console.log)
</script>`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        A public chatbot needs a stronger instruct model ({selected?.name ?? "none selected"}).
        Tiny models such as smollm2 will not stay on-script. Use qwen2.5 or llama3.1+ if you can.
        This computer must be reachable, or use a tunnel.
      </p>
      <DefaultModelSelect models={models} />
      <div className="flex flex-col gap-2">
        <Label>Webhook secret</Label>
        <Input
          value={secret}
          onChange={(e) => {
            useStudio.getState().setStudio({ channelSecret: e.target.value });
            void syncStudio({ channelSecret: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>WhatsApp / Instagram verify token</Label>
        <Input
          value={verify}
          onChange={(e) => {
            useStudio.getState().setStudio({ channelVerify: e.target.value });
            void syncStudio({ channelVerify: e.target.value });
          }}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Website snippet</p>
        <pre className="overflow-x-auto rounded-xl bg-secondary p-4 font-mono text-xs">{widget}</pre>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">WhatsApp Cloud API</p>
        <p className="text-sm text-muted-foreground text-pretty">
          In Meta Developer, set the callback URL to {webhook} and the verify token above. Incoming
          text is answered by your default model. Instagram Messaging uses the same webhook shape;
          you still need a Meta app and a professional account. This app cannot log into Instagram or
          WhatsApp for you.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Installed models: {models.map((m) => m.name).join(", ") || "none"}
      </p>
    </div>
  );
}

function InstructionsTab() {
  const items = useStudio((s) => s.instructions);
  const [name, setName] = useState("Support voice");
  const [text, setText] = useState("Answer as a concise support agent. Never invent policies.");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enabled instructions are prepended to every chat and to the public API / channel bots.
      </p>
      {items.map((item) => (
        <label key={item.id} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(e) => {
                useStudio.getState().setStudio({
                  instructions: items.map((i) =>
                    i.id === item.id ? { ...i, enabled: e.target.checked } : i,
                  ),
                });
                void syncStudio();
              }}
            />
            {item.name}
          </span>
          <span className="text-sm text-muted-foreground whitespace-pre-wrap">{item.text}</span>
        </label>
      ))}
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name" />
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <Button
        onClick={() => {
          useStudio.getState().addInstruction({
            id: crypto.randomUUID(),
            name: name.trim() || "Instruction",
            text: text.trim(),
            enabled: true,
          });
          void syncStudio();
        }}
      >
        Add instruction
      </Button>
    </div>
  );
}

function TrainTab({ selected }: { selected: ModelRef | null }) {
  const knowledge = useStudio((s) => s.knowledge);
  const enabled = useStudio((s) => s.knowledgeEnabled);
  const conversations = useChatStore((s) => s.conversations);
  const [title, setTitle] = useState("Product facts");
  const [body, setBody] = useState("");
  const canTrain = modelCanFineTune(selected);

  function exportJsonl() {
    const lines = conversations
      .filter((c) => c.messages.length > 0)
      .map((c) =>
        JSON.stringify({
          messages: c.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      );
    const blob = new Blob([lines.join("\n")], { type: "application/jsonl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ollama-ui-train.jsonl";
    a.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border px-4 py-3 text-sm text-pretty">
        {selected
          ? canTrain
            ? `${selected.name} can be fine-tuned with external tools (Unsloth, LLaMA-Factory), then imported as GGUF. Ollama cannot train it while you chat. Knowledge below is RAG: the text is given as context, not weights.`
            : `${selected.name} is not a good fine-tune target in this app (vision / embedding / unknown). Use Knowledge for facts, or pick Llama, Qwen, Phi, Gemma, or SmolLM2 to export data.`
          : "Pick a model to see if training is possible."}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            useStudio.getState().setStudio({ knowledgeEnabled: e.target.checked });
            void syncStudio({ knowledgeEnabled: e.target.checked });
          }}
        />
        Attach knowledge to chats and the API
      </label>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste text the model should know" />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            if (!body.trim()) return;
            useStudio.getState().addKnowledge({
              id: crypto.randomUUID(),
              title: title.trim() || "Note",
              text: body.trim(),
              source: "manual",
              createdAt: Date.now(),
            });
            void syncStudio();
            setBody("");
          }}
        >
          Save as knowledge
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const text = conversations
              .flatMap((c) => c.messages.filter((m) => m.role === "user" || m.role === "assistant"))
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n\n");
            useStudio.getState().addKnowledge({
              id: crypto.randomUUID(),
              title: "Chat history",
              text: text.slice(0, 20000),
              source: "chat",
              createdAt: Date.now(),
            });
            void syncStudio();
            toast.success("Chats added as knowledge (not training)");
          }}
        >
          Use chats as knowledge
        </Button>
        <Button variant="outline" onClick={exportJsonl}>
          Export chats as JSONL
        </Button>
      </div>
      {knowledge.map((doc) => (
        <div key={doc.id} className="flex items-start justify-between gap-2 rounded-xl border border-border px-4 py-3">
          <div>
            <p className="font-medium">{doc.title}</p>
            <p className="text-xs text-muted-foreground">{doc.source}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => {
            useStudio.getState().removeKnowledge(doc.id);
            void syncStudio();
          }}>
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

function AdvisorTab({ selected }: { selected: ModelRef | null }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border px-4 py-3 text-sm">{adviceForModel(selected)}</p>
      {TASK_ADVICE.map((item) => (
        <div key={item.id} className="rounded-xl border border-border px-4 py-3">
          <p className="font-medium">{item.task}</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{item.blurb}</p>
          <p className="mt-2 font-mono text-xs">{item.pull.join(" · ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.needs}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.trainNote}</p>
        </div>
      ))}
    </div>
  );
}
