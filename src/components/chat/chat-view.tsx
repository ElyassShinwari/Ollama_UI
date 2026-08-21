import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/chat/composer";
import { ContextMeter } from "@/components/chat/context-meter";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ModelPicker } from "@/components/chat/model-picker";
import { estimateTokens, greetingForNow, isContextOverflowError } from "@/lib/utils";
import { selectActiveConversation, useChatStore } from "@/lib/chat/store";
import { streamChat } from "@/lib/llm/catalog";
import type { ModelRef } from "@/lib/chat/types";

const SUGGESTIONS = [
  "Explain a hard idea in plain language",
  "Draft a short, direct email",
  "Find holes in this plan",
  "Write a small function and walk through it",
];

export function ChatView({
  models,
  onOpenSidebar,
  onToggleSidebar,
  onNewChat,
}: {
  models: ModelRef[];
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}) {
  const conversation = useChatStore(selectActiveConversation);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const settings = useChatStore((s) => s.settings);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const dropAfter = useChatStore((s) => s.dropAfter);
  const editUserMessage = useChatStore((s) => s.editUserMessage);
  const setUsage = useChatStore((s) => s.setUsage);
  const markContextExceeded = useChatStore((s) => s.markContextExceeded);
  const [draft, setDraft] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const messages = conversation?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const contextLimit = selectedModel?.contextLength ?? conversation?.model.contextLength;
  const contextUsed = conversation?.contextTokens ?? 0;
  const contextFull =
    Boolean(conversation?.contextExceeded) ||
    (contextLimit != null && contextUsed >= contextLimit);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.toString() && scrollerRef.current?.contains(sel.anchorNode)) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingId]);

  const greeting = useMemo(() => greetingForNow(), []);

  async function runCompletion(conversationId: string, history: { role: string; content: string }[]) {
    const model = useChatStore.getState().selectedModel;
    if (!model) {
      toast.error("Choose a model first");
      return;
    }
    const promptEstimate = estimateTokens(
      [settings.systemPrompt, ...history.map((m) => m.content)].join("\n"),
    );
    const limit = model.contextLength;
    if (limit && promptEstimate >= limit) {
      markContextExceeded(conversationId);
      toast.error("This model's context window is full");
      return;
    }
    setUsage(conversationId, { promptTokens: promptEstimate, completionTokens: 0 });
    const assistantId = startAssistantMessage(conversationId, model);
    setStreamingId(assistantId);
    const controller = new AbortController();
    abortRef.current = controller;
    let gotUsage = false;
    try {
      await streamChat(
        {
          provider: model.provider,
          transport: model.transport,
          host: settings.ollamaHost,
          model: model.id,
          messages: history,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt,
          contextLength: model.contextLength,
        },
        (chunk) => appendToMessage(conversationId, assistantId, chunk),
        controller.signal,
        (usage) => {
          gotUsage = true;
          setUsage(conversationId, usage);
        },
      );
      if (!gotUsage) {
        const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
        const text = conv?.messages.map((m) => m.content).join("\n") ?? "";
        const promptTokens = estimateTokens(history.map((m) => m.content).join("\n"));
        const completionTokens = estimateTokens(
          conv?.messages.find((m) => m.id === assistantId)?.content ?? "",
        );
        setUsage(conversationId, { promptTokens, completionTokens });
        const limit = model.contextLength;
        if (limit && promptTokens + completionTokens >= limit) {
          markContextExceeded(conversationId);
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "The model failed to reply";
      if (isContextOverflowError(message)) {
        markContextExceeded(conversationId);
        toast.error("This model's context window is full");
      }
      const current = useChatStore
        .getState()
        .conversations.find((c) => c.id === conversationId)
        ?.messages.find((m) => m.id === assistantId);
      if (!current?.content) {
        appendToMessage(
          conversationId,
          assistantId,
          isContextOverflowError(message)
            ? "The context limit is full. Start a new chat to reset the window."
            : `I couldn't complete that reply. ${message}`,
        );
      } else if (!isContextOverflowError(message)) {
        toast.error(message);
      }
    } finally {
      setStreamingId(null);
      abortRef.current = null;
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streamingId) return;
    if (contextFull) {
      toast.error("Context is full. Start a new chat to continue.");
      return;
    }
    setDraft("");
    stickToBottomRef.current = true;
    const { conversationId, user } = addUserMessage(trimmed);
    const history = [
      ...(useChatStore.getState().conversations.find((c) => c.id === conversationId)?.messages ?? [])
        .filter((m) => m.id !== user.id && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: trimmed },
    ];
    await runCompletion(conversationId, history);
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function regenerate() {
    if (!conversation || streamingId) return;
    const lastUser = [...conversation.messages].reverse().find((m) => m.role === "user");
    const lastAsst = [...conversation.messages].reverse().find((m) => m.role === "assistant");
    if (!lastUser || !lastAsst) return;
    removeMessage(conversation.id, lastAsst.id);
    const history = conversation.messages
      .filter((m) => m.id !== lastAsst.id)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history);
  }

  async function retryFrom(messageId: string) {
    if (!conversation || streamingId) return;
    dropAfter(conversation.id, messageId);
    const history = (
      useChatStore.getState().conversations.find((c) => c.id === conversation.id)?.messages ?? []
    )
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history);
  }

  async function editFrom(messageId: string, content: string) {
    if (!conversation || streamingId) return;
    editUserMessage(conversation.id, messageId, content);
    const history = (
      useChatStore.getState().conversations.find((c) => c.id === conversation.id)?.messages ?? []
    )
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 md:px-3">
        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-5" />
        </Button>
        <ModelPicker models={models} value={selectedModel} onChange={setSelectedModel} />
        <div className="ml-auto">
          <ContextMeter used={contextUsed} limit={contextLimit} />
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
          stickToBottomRef.current = dist < 96;
        }}
      >
        {empty ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
            <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{greeting}</h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              {selectedModel
                ? `Talking with ${selectedModel.name}. Switch models anytime from the menu above.`
                : "Choose a model to begin."}
            </p>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm leading-6 transition-colors hover:bg-accent"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streaming={streamingId === message.id}
                showRegen={message.id === lastAssistant?.id && !streamingId}
                onRegenerate={regenerate}
                onRetry={
                  message.role === "user" && !streamingId
                    ? () => void retryFrom(message.id)
                    : undefined
                }
                onEdit={
                  message.role === "user" && !streamingId
                    ? (content) => void editFrom(message.id, content)
                    : undefined
                }
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {contextFull ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              This model's context window is full. Start a new chat to reset it and keep going.
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              New chat
            </Button>
          </div>
        </div>
      ) : null}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={stop}
        streaming={Boolean(streamingId)}
        disabled={!selectedModel || contextFull}
        placeholder={
          contextFull
            ? "Context is full — start a new chat"
            : selectedModel
              ? `Message ${selectedModel.name}`
              : "Choose a model to begin"
        }
      />
    </div>
  );
}
