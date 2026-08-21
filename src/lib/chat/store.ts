import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, ModelRef, Settings, TokenUsage } from "./types";

const defaultSettings: Settings = {
  ollamaHost: "http://127.0.0.1:11434",
  temperature: 0.7,
  systemPrompt: "",
  theme: "dark",
};

function uid() {
  return crypto.randomUUID();
}

function titleFrom(content: string) {
  const t = content.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, contextTokens: 0, contextExceeded: false };
}

function normalizeConversation(c: Conversation): Conversation {
  return {
    ...c,
    promptTokens: c.promptTokens ?? 0,
    completionTokens: c.completionTokens ?? 0,
    contextTokens: c.contextTokens ?? 0,
  };
}

function pendingModel(): ModelRef {
  return {
    id: "pending",
    name: "Choose a model",
    provider: "ollama",
    transport: "server",
  };
}

type ChatState = {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelRef | null;
  settings: Settings;
  sidebarCollapsed: boolean;
  search: string;
  setSearch: (q: string) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setSelectedModel: (model: ModelRef) => void;
  newChat: () => string;
  setActive: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  addUserMessage: (content: string) => { conversationId: string; user: Message };
  startAssistantMessage: (conversationId: string, model: ModelRef) => string;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
  finishMessage: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  replaceMessageContent: (conversationId: string, messageId: string, content: string) => void;
  dropAfter: (conversationId: string, messageId: string) => void;
  editUserMessage: (conversationId: string, messageId: string, content: string) => void;
  setUsage: (conversationId: string, usage: TokenUsage, exceeded?: boolean) => void;
  resetUsage: (conversationId: string) => void;
  markContextExceeded: (conversationId: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      selectedModel: null,
      settings: defaultSettings,
      sidebarCollapsed: false,
      search: "",
      setSearch: (search) => set({ search }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setSelectedModel: (model) =>
        set((s) => ({
          selectedModel: model,
          conversations: s.conversations.map((c) =>
            c.id === s.activeId ? { ...c, model } : c,
          ),
        })),
      newChat: () => {
        const model = get().selectedModel;
        const empty = get().conversations.find((c) => c.messages.length === 0);
        if (empty) {
          set((s) => ({
            activeId: empty.id,
            conversations: s.conversations.map((c) =>
              c.id === empty.id
                ? {
                    ...c,
                    model: model ?? c.model,
                    ...emptyUsage(),
                    updatedAt: Date.now(),
                  }
                : c,
            ),
          }));
          return empty.id;
        }
        const now = Date.now();
        const conversation: Conversation = {
          id: uid(),
          title: "New chat",
          model: model ?? pendingModel(),
          messages: [],
          createdAt: now,
          updatedAt: now,
          ...emptyUsage(),
        };
        set((s) => ({
          conversations: [conversation, ...s.conversations],
          activeId: conversation.id,
        }));
        return conversation.id;
      },
      setActive: (activeId) => {
        set((s) => {
          const conversations = s.conversations.filter(
            (c) => c.messages.length > 0 || c.id === activeId,
          );
          const conv = conversations.find((c) => c.id === activeId);
          return {
            conversations,
            activeId,
            selectedModel: conv?.model ?? s.selectedModel,
          };
        });
      },
      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const activeId =
            s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId;
          return { conversations, activeId };
        }),
      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
          ),
        })),
      togglePin: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned, updatedAt: Date.now() } : c,
          ),
        })),
      addUserMessage: (content) => {
        const now = Date.now();
        const user: Message = {
          id: uid(),
          role: "user",
          content,
          createdAt: now,
        };
        let conversationId = get().activeId;
        const existing = get().conversations.find((c) => c.id === conversationId);
        if (!conversationId || !existing) {
          conversationId = get().newChat();
        }
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const titled =
              c.messages.length === 0 && c.title === "New chat"
                ? titleFrom(content)
                : c.title;
            return {
              ...c,
              title: titled,
              messages: [...c.messages, user],
              updatedAt: now,
              model: s.selectedModel ?? c.model,
            };
          }),
          activeId: conversationId,
        }));
        return { conversationId: conversationId!, user };
      },
      startAssistantMessage: (conversationId, model) => {
        const id = uid();
        const now = Date.now();
        const message: Message = {
          id,
          role: "assistant",
          content: "",
          modelId: model.id,
          createdAt: now,
        };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, message], updatedAt: now }
              : c,
          ),
        }));
        return id;
      },
      appendToMessage: (conversationId, messageId, chunk) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + chunk } : m,
                  ),
                }
              : c,
          ),
        })),
      finishMessage: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m } : m,
                  ),
                }
              : c,
          ),
        })),
      removeMessage: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== messageId),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        })),
      replaceMessageContent: (conversationId, messageId, content) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        })),
      dropAfter: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            if (idx < 0) return c;
            return {
              ...c,
              messages: c.messages.slice(0, idx + 1),
              updatedAt: Date.now(),
              contextExceeded: false,
            };
          }),
        })),
      editUserMessage: (conversationId, messageId, content) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            if (idx < 0) return c;
            const kept = c.messages.slice(0, idx + 1).map((m) =>
              m.id === messageId ? { ...m, content } : m,
            );
            return {
              ...c,
              messages: kept,
              title: idx === 0 ? titleFrom(content) : c.title,
              updatedAt: Date.now(),
              contextExceeded: false,
            };
          }),
        })),
      setUsage: (conversationId, usage, exceeded) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const contextTokens = usage.promptTokens + usage.completionTokens;
            const limit = s.selectedModel?.contextLength ?? c.model.contextLength;
            return {
              ...c,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              contextTokens,
              contextExceeded:
                exceeded ?? (limit != null && contextTokens >= limit),
              updatedAt: Date.now(),
            };
          }),
        })),
      resetUsage: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, ...emptyUsage() } : c,
          ),
        })),
      markContextExceeded: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, contextExceeded: true } : c,
          ),
        })),
    }),
    {
      name: "ollama-ui",
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        selectedModel: s.selectedModel,
        settings: s.settings,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        return {
          ...current,
          ...p,
          settings: { ...defaultSettings, ...p.settings },
          conversations: (p.conversations ?? current.conversations).map(normalizeConversation),
        };
      },
    },
  ),
);

export function selectActiveConversation(state: ChatState) {
  return state.conversations.find((c) => c.id === state.activeId) ?? null;
}
