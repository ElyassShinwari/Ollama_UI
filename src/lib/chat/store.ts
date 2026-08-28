import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { t, detectLocale, isLocaleId } from "@/lib/i18n";
import { linkLinearMessages, visibleMessages } from "./tree";
import type { Conversation, Message, ModelRef, Settings, TokenUsage } from "./types";

const defaultSettings: Settings = {
  ollamaHost: "http://127.0.0.1:11434",
  temperature: 0.7,
  systemPrompt: "",
  theme: "light",
  locale: detectLocale(),
  openaiKey: "",
  anthropicKey: "",
  xaiKey: "",
  kimiKey: "",
  deepseekKey: "",
  openaiOAuth: null,
  xaiOAuth: null,
  kimiOAuth: null,
};

function uid() {
  return crypto.randomUUID();
}

function titleFrom(content: string, locale?: string) {
  const t0 = content.replace(/\s+/g, " ").trim();
  if (!t0) return t(locale, "newChat");
  return t0.length > 42 ? `${t0.slice(0, 42)}…` : t0;
}

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, contextTokens: 0, contextExceeded: false };
}

function normalizeConversation(c: Conversation): Conversation {
  const messages = linkLinearMessages(c.messages ?? []);
  const roots = messages.filter((m) => !m.parentId);
  return {
    ...c,
    messages,
    activeRootId: c.activeRootId ?? roots[0]?.id ?? null,
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

function selectOnParent(messages: Message[], parentId: string | null, childId: string): Message[] {
  if (!parentId) return messages;
  return messages.map((m) => (m.id === parentId ? { ...m, selectedChildId: childId } : m));
}

type ChatState = {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelRef | null;
  testerKey: string | null;
  settings: Settings;
  sidebarCollapsed: boolean;
  search: string;
  setSearch: (q: string) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setSelectedModel: (model: ModelRef) => void;
  setTesterKey: (key: string | null) => void;
  newChat: () => string;
  setActive: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  addUserMessage: (content: string, extra?: { images?: string[]; documents?: Message["documents"]; attachments?: Message["attachments"]; conversationId?: string; role?: "user" | "note" }) => { conversationId: string; user: Message };
  startAssistantMessage: (conversationId: string, model: ModelRef, parentId: string) => string;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
  finishMessage: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  replaceMessageContent: (conversationId: string, messageId: string, content: string) => void;
  dropAfter: (conversationId: string, messageId: string) => void;
  forkUserMessage: (conversationId: string, messageId: string, content: string) => Message;
  selectSibling: (conversationId: string, messageId: string) => void;
  setUsage: (conversationId: string, usage: TokenUsage, exceeded?: boolean) => void;
  resetUsage: (conversationId: string) => void;
  markContextExceeded: (conversationId: string) => void;
  dropBinary: (conversationId: string) => void;
};

export const chatPersist = { enabled: true };

function withoutBinary(messages: Message[]): Message[] {
  return messages.map((m) => ({
    ...m,
    images: undefined,
    documents: m.documents?.map((d) => ({ name: d.name, mime: d.mime, data: "" })),
  }));
}

type PersistedChat = {
  conversations: Conversation[];
  activeId: string | null;
  selectedModel: ModelRef | null;
  testerKey: string | null;
  settings: Settings;
  sidebarCollapsed: boolean;
};

function slimPersisted(state: PersistedChat): PersistedChat {
  return {
    ...state,
    conversations: state.conversations.map((c) => ({
      ...c,
      messages: withoutBinary(c.messages),
    })),
  };
}

const persistStorage: PersistStorage<PersistedChat> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      return JSON.parse(raw) as { state: PersistedChat; version?: number };
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (!chatPersist.enabled) return;
    try {
      localStorage.setItem(
        name,
        JSON.stringify({ ...value, state: slimPersisted(value.state) }),
      );
    } catch {
      /* quota — keep running */
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      selectedModel: null,
      testerKey: null,
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
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            const limit = model.contextLength;
            const used = c.contextTokens ?? 0;
            return {
              ...c,
              model,
              contextExceeded: limit != null && used >= limit,
            };
          }),
        })),
      setTesterKey: (testerKey) => set({ testerKey }),
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
                    activeRootId: null,
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
          title: t(get().settings.locale, "newChat"),
          model: model ?? pendingModel(),
          messages: [],
          createdAt: now,
          updatedAt: now,
          activeRootId: null,
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
          const conv = conversations.find((c) => c.id === activeId);
          return { conversations, activeId, selectedModel: conv?.model ?? s.selectedModel };
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
      addUserMessage: (content, extra) => {
        const now = Date.now();
        let conversationId = extra?.conversationId ?? get().activeId;
        const existing = get().conversations.find((c) => c.id === conversationId);
        if (!conversationId || !existing) {
          conversationId = get().newChat();
        }
        const conv = get().conversations.find((c) => c.id === conversationId)!;
        const visible = visibleMessages(conv.messages, conv.activeRootId);
        const parent = visible[visible.length - 1];
        const isNote = extra?.role === "note";
        const user: Message = {
          id: uid(),
          role: isNote ? "note" : "user",
          content,
          createdAt: now,
          parentId: parent?.id ?? null,
          selectedChildId: null,
          images: extra?.images,
          documents: extra?.documents,
          attachments: extra?.attachments,
        };
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const untitled =
              !isNote &&
              visible.length === 0 &&
              (c.title === "New chat" || c.title === t(s.settings.locale, "newChat"));
            const titled = untitled ? titleFrom(content, s.settings.locale) : c.title;
            let messages = [...c.messages, user];
            messages = selectOnParent(messages, parent?.id ?? null, user.id);
            return {
              ...c,
              title: titled,
              messages,
              activeRootId: parent ? c.activeRootId : user.id,
              updatedAt: now,
              model: s.selectedModel ?? c.model,
            };
          }),
          activeId: conversationId,
        }));
        return { conversationId: conversationId!, user };
      },
      startAssistantMessage: (conversationId, model, parentId) => {
        const id = uid();
        const now = Date.now();
        const message: Message = {
          id,
          role: "assistant",
          content: "",
          modelId: model.id,
          modelName: model.name,
          createdAt: now,
          parentId,
          selectedChildId: null,
        };
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              messages: selectOnParent([...c.messages, message], parentId, id),
              updatedAt: now,
            };
          }),
        }));
        return id;
      },
      appendToMessage: (conversationId, messageId, chunk) =>
        set((s) => {
          const ci = s.conversations.findIndex((c) => c.id === conversationId);
          if (ci < 0) return s;
          const conv = s.conversations[ci]!;
          const mi = conv.messages.findIndex((m) => m.id === messageId);
          if (mi < 0) return s;
          const messages = conv.messages.slice();
          const prev = messages[mi]!;
          messages[mi] = { ...prev, content: prev.content + chunk };
          const conversations = s.conversations.slice();
          conversations[ci] = { ...conv, messages };
          return { conversations };
        }),
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
            const msg = c.messages.find((m) => m.id === messageId);
            if (!msg) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, selectedChildId: null } : m,
              ),
              updatedAt: Date.now(),
              contextExceeded: false,
            };
          }),
        })),
      forkUserMessage: (conversationId, messageId, content) => {
        const conv = get().conversations.find((c) => c.id === conversationId);
        const old = conv?.messages.find((m) => m.id === messageId);
        const user: Message = {
          id: uid(),
          role: "user",
          content,
          createdAt: Date.now(),
          parentId: old?.parentId ?? null,
          selectedChildId: null,
          images: old?.images,
          documents: old?.documents,
          attachments: old?.attachments,
        };
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            let messages = [...c.messages, user];
            messages = selectOnParent(messages, user.parentId ?? null, user.id);
            const first = visibleMessages(c.messages, c.activeRootId)[0];
            return {
              ...c,
              messages,
              activeRootId: user.parentId ? c.activeRootId : user.id,
              title:
                !user.parentId || first?.id === messageId
                  ? titleFrom(content, s.settings.locale)
                  : c.title,
              updatedAt: Date.now(),
              contextExceeded: false,
            };
          }),
        }));
        return user;
      },
      selectSibling: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const msg = c.messages.find((m) => m.id === messageId);
            if (!msg) return c;
            if (!msg.parentId) {
              return { ...c, activeRootId: msg.id, updatedAt: Date.now() };
            }
            return {
              ...c,
              messages: selectOnParent(c.messages, msg.parentId, msg.id),
              updatedAt: Date.now(),
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
      dropBinary: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const next = c.messages.map((m) => {
              if (!m.documents?.some((d) => d.data)) return m;
              return {
                ...m,
                documents: m.documents.map((d) => ({ name: d.name, mime: d.mime, data: "" })),
              };
            });
            return { ...c, messages: next };
          }),
        })),
    }),
    {
      name: "ollama-ui",
      storage: persistStorage,
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        selectedModel: s.selectedModel,
        testerKey: s.testerKey,
        settings: s.settings,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ChatState>;
        return {
          ...current,
          ...p,
          settings: {
            ...defaultSettings,
            ...p.settings,
            locale: isLocaleId(p.settings?.locale) ? p.settings.locale : defaultSettings.locale,
          },
          conversations: (p.conversations ?? current.conversations).map(normalizeConversation),
        };
      },
    },
  ),
);

export function selectActiveConversation(state: ChatState) {
  return state.conversations.find((c) => c.id === state.activeId) ?? null;
}
