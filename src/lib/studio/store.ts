import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultStudio, type InstructionPreset, type KnowledgeDoc, type McpServerConfig, type StudioConfig } from "./types";

type StudioState = StudioConfig & {
  setStudio: (patch: Partial<StudioConfig>) => void;
  addMcp: (server: McpServerConfig) => void;
  removeMcp: (id: string) => void;
  addInstruction: (preset: InstructionPreset) => void;
  addKnowledge: (doc: KnowledgeDoc) => void;
  removeKnowledge: (id: string) => void;
};

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      ...defaultStudio(),
      setStudio: (patch) => set(patch),
      addMcp: (server) => set({ mcpServers: [...get().mcpServers, server] }),
      removeMcp: (id) => set({ mcpServers: get().mcpServers.filter((s) => s.id !== id) }),
      addInstruction: (preset) => set({ instructions: [...get().instructions, preset] }),
      addKnowledge: (doc) => set({ knowledge: [doc, ...get().knowledge].slice(0, 40) }),
      removeKnowledge: (id) => set({ knowledge: get().knowledge.filter((d) => d.id !== id) }),
    }),
    {
      name: "ollama-ui-studio",
      merge: (persisted, current) => ({
        ...current,
        ...((persisted as Partial<StudioState> | undefined) ?? {}),
      }),
    },
  ),
);

export async function syncStudio(patch?: Partial<StudioConfig>) {
  if (patch) useStudio.getState().setStudio(patch);
  const state = useStudio.getState();
  const body: StudioConfig = {
    githubToken: state.githubToken,
    repos: state.repos,
    mcpServers: state.mcpServers,
    apiEnabled: state.apiEnabled,
    apiKey: state.apiKey,
    channelSecret: state.channelSecret,
    channelVerify: state.channelVerify,
    defaultModel: state.defaultModel,
    ollamaHost: state.ollamaHost,
    instructions: state.instructions,
    knowledge: state.knowledge,
    knowledgeEnabled: state.knowledgeEnabled,
    n8nKind: state.n8nKind,
    n8nBaseUrl: state.n8nBaseUrl,
    n8nApiKey: state.n8nApiKey,
    n8nWebhookUrl: state.n8nWebhookUrl,
    n8nSecret: state.n8nSecret,
    n8nEnabled: state.n8nEnabled,
    n8nSendOnChat: state.n8nSendOnChat,
  };
  await fetch("/api/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function combinedInstructions() {
  const s = useStudio.getState();
  return s.instructions
    .filter((i) => i.enabled && i.text.trim())
    .map((i) => i.text.trim())
    .join("\n\n");
}

export function knowledgeBlock() {
  const s = useStudio.getState();
  if (!s.knowledgeEnabled || s.knowledge.length === 0) return "";
  return s.knowledge
    .slice(0, 6)
    .map((k) => `### ${k.title}\n${k.text.slice(0, 2500)}`)
    .join("\n\n");
}

export function randomKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function notifyN8n(payload: {
  event: "assistant" | "ping";
  user?: string;
  assistant?: string;
  model?: string;
  conversationId?: string;
}) {
  const s = useStudio.getState();
  if (!s.n8nEnabled || !s.n8nSendOnChat || !s.n8nWebhookUrl.trim()) return;
  void fetch("/api/n8n/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
