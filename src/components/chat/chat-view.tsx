import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Composer } from "@/components/chat/composer";
import { ContextMeter } from "@/components/chat/context-meter";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ModelPicker } from "@/components/chat/model-picker";
import { estimateTokens, greetingForNow, isContextOverflowError } from "@/lib/utils";
import { selectActiveConversation, useChatStore } from "@/lib/chat/store";
import { siblingsOf, visibleMessages } from "@/lib/chat/tree";
import { streamChat } from "@/lib/llm/catalog";
import {
  acceptedExtensions,
  buildMessageFromFiles,
  readDroppedFile,
  unsupportedHint,
  type PendingFile,
} from "@/lib/llm/files";
import { repetitionCutoff } from "@/lib/llm/repeat";
import { countModelTokens, formatChatPrompt } from "@/lib/llm/tokens";
import { combinedInstructions, knowledgeBlock } from "@/lib/studio/store";
import type { Message, ModelRef } from "@/lib/chat/types";

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
  onBrowseModels,
}: {
  models: ModelRef[];
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onBrowseModels?: () => void;
}) {
  const conversation = useChatStore(selectActiveConversation);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const settings = useChatStore((s) => s.settings);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const startAssistantMessage = useChatStore((s) => s.startAssistantMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const replaceMessageContent = useChatStore((s) => s.replaceMessageContent);
  const forkUserMessage = useChatStore((s) => s.forkUserMessage);
  const selectSibling = useChatStore((s) => s.selectSibling);
  const setUsage = useChatStore((s) => s.setUsage);
  const markContextExceeded = useChatStore((s) => s.markContextExceeded);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingModel, setPendingModel] = useState<ModelRef | null>(null);
  const [switchWarn, setSwitchWarn] = useState<{ name: string; used: number; limit: number } | null>(
    null,
  );
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const promptTokensRef = useRef(0);
  const completionTokensRef = useRef(0);
  const tokenTimerRef = useRef<number | null>(null);

  const allMessages = conversation?.messages ?? [];
  const messages = conversation
    ? visibleMessages(conversation.messages, conversation.activeRootId)
    : [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const contextLimit = selectedModel?.contextLength ?? conversation?.model.contextLength;
  const contextUsed = conversation?.contextTokens ?? 0;
  const contextFull =
    Boolean(conversation?.contextExceeded) ||
    (contextLimit != null && contextUsed >= contextLimit);

  const visibleKey = messages.map((m) => m.id).join(">");

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.toString() && scrollerRef.current?.contains(sel.anchorNode)) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingId]);

  useEffect(() => {
    if (!conversation || streamingId) return;
    const model = useChatStore.getState().selectedModel;
    if (!model) return;
    const visible = visibleMessages(conversation.messages, conversation.activeRootId);
    if (visible.length === 0) {
      useChatStore.getState().resetUsage(conversation.id);
      return;
    }
    const last = visible[visible.length - 1];
    const promptMsgs =
      last?.role === "assistant" ? visible.slice(0, -1) : visible;
    const completionText = last?.role === "assistant" ? last.content : "";
    let cancelled = false;
    void (async () => {
      const prompt = formatChatPrompt(
        [useChatStore.getState().settings.systemPrompt, combinedInstructions(), knowledgeBlock()]
          .filter(Boolean)
          .join("\n\n"),
        promptMsgs.map((m) => ({ role: m.role, content: m.content })),
      );
      const [promptTokens, completionTokens] = await Promise.all([
        countModelTokens({
          host: useChatStore.getState().settings.ollamaHost,
          model: model.id,
          text: prompt,
          transport: model.transport,
        }),
        completionText
          ? countModelTokens({
              host: useChatStore.getState().settings.ollamaHost,
              model: model.id,
              text: completionText,
              transport: model.transport,
            })
          : Promise.resolve(0),
      ]);
      if (cancelled) return;
      promptTokensRef.current = promptTokens;
      completionTokensRef.current = completionTokens;
      setUsage(conversation.id, { promptTokens, completionTokens });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, visibleKey, streamingId, setUsage]);

  const greeting = useMemo(() => greetingForNow(), []);

  function publishUsage(conversationId: string, promptTokens: number, completionTokens: number) {
    promptTokensRef.current = promptTokens;
    completionTokensRef.current = completionTokens;
    setUsage(conversationId, { promptTokens, completionTokens });
  }

  function scheduleCompletionCount(
    conversationId: string,
    model: ModelRef,
    assistantText: string,
  ) {
    if (tokenTimerRef.current) window.clearTimeout(tokenTimerRef.current);
    tokenTimerRef.current = window.setTimeout(() => {
      void countModelTokens({
        host: useChatStore.getState().settings.ollamaHost,
        model: model.id,
        text: assistantText,
        transport: model.transport,
      }).then((n) => {
        if (abortRef.current) publishUsage(conversationId, promptTokensRef.current, n);
      });
    }, 120);
  }

  async function runCompletion(
    conversationId: string,
    history: { role: string; content: string; images?: string[] }[],
    parentId: string,
  ) {
    const model = useChatStore.getState().selectedModel;
    if (!model) {
      toast.error("Choose a model first");
      return;
    }
    const systemPrompt = [settings.systemPrompt, combinedInstructions(), knowledgeBlock()]
      .filter(Boolean)
      .join("\n\n");
    const promptText = formatChatPrompt(systemPrompt, history);
    const promptEstimate = estimateTokens(promptText);
    const limit = model.contextLength;
    if (limit && promptEstimate >= limit) {
      markContextExceeded(conversationId);
    }
    publishUsage(conversationId, promptEstimate, 0);
    void countModelTokens({
      host: settings.ollamaHost,
      model: model.id,
      text: promptText,
      transport: model.transport,
    }).then((n) => {
      if (limit && n >= limit) markContextExceeded(conversationId);
      publishUsage(conversationId, n, completionTokensRef.current);
    });

    const assistantId = startAssistantMessage(conversationId, model, parentId);
    setStreamingId(assistantId);
    const controller = new AbortController();
    abortRef.current = controller;
    let stoppedLoop = false;
    try {
      await streamChat(
        {
          provider: model.provider,
          transport: model.transport,
          host: settings.ollamaHost,
          model: model.id,
          messages: history,
          temperature: settings.temperature,
          systemPrompt,
          contextLength: model.contextLength,
        },
        (chunk) => {
          const current = useChatStore
            .getState()
            .conversations.find((c) => c.id === conversationId)
            ?.messages.find((m) => m.id === assistantId);
          const next = `${current?.content ?? ""}${chunk}`;
          const cut = repetitionCutoff(next);
          if (cut != null) {
            stoppedLoop = true;
            replaceMessageContent(conversationId, assistantId, next.slice(0, cut).trimEnd());
            controller.abort();
            return;
          }
          appendToMessage(conversationId, assistantId, chunk);
          completionTokensRef.current += Math.max(1, estimateTokens(chunk));
          publishUsage(conversationId, promptTokensRef.current, completionTokensRef.current);
          scheduleCompletionCount(conversationId, model, next);
        },
        controller.signal,
        (usage) => {
          publishUsage(conversationId, usage.promptTokens, usage.completionTokens);
        },
      );
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        if (stoppedLoop) {
          toast("Stopped a repeating reply");
        }
        return;
      }
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
            ? "The context window is full. You can keep chatting, but answers may be unexpected or inaccurate."
            : `I couldn't complete that reply. ${message}`,
        );
      } else if (!isContextOverflowError(message)) {
        toast.error(message);
      }
    } finally {
      if (tokenTimerRef.current) window.clearTimeout(tokenTimerRef.current);
      setStreamingId(null);
      abortRef.current = null;
      const text =
        useChatStore
          .getState()
          .conversations.find((c) => c.id === conversationId)
          ?.messages.find((m) => m.id === assistantId)?.content ?? "";
      if (text && model) {
        void countModelTokens({
          host: settings.ollamaHost,
          model: model.id,
          text,
          transport: model.transport,
        }).then((n) => publishUsage(conversationId, promptTokensRef.current, n));
      }
    }
  }

  async function send(text: string, extraFiles: PendingFile[] = files) {
    const built = buildMessageFromFiles(text, extraFiles);
    if (streamingId) return;
    if (!built.content.trim() && !built.images?.length) return;
    setDraft("");
    setFiles([]);
    stickToBottomRef.current = true;
    const { conversationId, user } = addUserMessage(built.content, {
      images: built.images,
      attachments: built.attachments,
    });
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
    const history = conv
      ? visibleMessages(conv.messages, conv.activeRootId)
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content, images: m.images }))
      : [{ role: "user", content: built.content, images: built.images }];
    await runCompletion(conversationId, history, user.id);
  }

  function stop() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (!fileHint) return;
    const id = window.setTimeout(() => setFileHint(null), 5000);
    return () => window.clearTimeout(id);
  }, [fileHint]);

  async function ingestFiles(list: FileList | File[]) {
    const model = useChatStore.getState().selectedModel;
    if (!model) return;
    const incoming = Array.from(list);
    const next: PendingFile[] = [];
    let rejected = false;
    for (const file of incoming) {
      const result = await readDroppedFile(file, model);
      if (result.ok) next.push(result.file);
      else rejected = true;
    }
    if (next.length) setFiles((cur) => [...cur, ...next]);
    if (rejected) setFileHint(unsupportedHint(model.name, model));
  }

  const fileAccept = selectedModel ? acceptedExtensions(selectedModel).join(",") : ".txt";

  function applyModel(model: ModelRef) {
    const used = conversation?.contextTokens ?? 0;
    const limit = model.contextLength;
    const hasChat = (conversation?.messages.length ?? 0) > 0;
    setSelectedModel(model);
    if (hasChat && limit && used >= limit) {
      markContextExceeded(conversation!.id);
      setSwitchWarn({ name: model.name, used, limit });
    } else {
      setSwitchWarn(null);
      if (conversation) {
        setUsage(
          conversation.id,
          {
            promptTokens: conversation.promptTokens,
            completionTokens: conversation.completionTokens,
          },
          false,
        );
      }
    }
  }

  function requestSwitch(model: ModelRef) {
    if (model.id === selectedModel?.id && model.provider === selectedModel.provider) return;
    const used = conversation?.contextTokens ?? 0;
    const limit = model.contextLength;
    const hasChat = (conversation?.messages.length ?? 0) > 0;
    if (hasChat && limit && used > limit) {
      setPendingModel(model);
      return;
    }
    applyModel(model);
  }

  async function regenerate() {
    if (!conversation || streamingId) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const history = messages
      .filter((m) => m.id !== lastAssistant?.id)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content, images: m.images }));
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, lastUser.id);
  }

  async function retryFrom(messageId: string) {
    if (!conversation || streamingId) return;
    const user = conversation.messages.find((m) => m.id === messageId);
    if (!user || user.role !== "user") return;
    selectSibling(conversation.id, user.id);
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversation.id);
    if (!conv) return;
    const path = visibleMessages(conv.messages, conv.activeRootId).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const history = [];
    for (const m of path) {
      history.push({ role: m.role, content: m.content, images: m.images });
      if (m.id === user.id) break;
    }
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, user.id);
  }

  async function editFrom(messageId: string, content: string) {
    if (!conversation || streamingId) return;
    const user = forkUserMessage(conversation.id, messageId, content);
    const conv = useChatStore.getState().conversations.find((c) => c.id === conversation.id);
    if (!conv) return;
    const path = visibleMessages(conv.messages, conv.activeRootId).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const history = [];
    for (const m of path) {
      history.push({ role: m.role, content: m.content, images: m.images });
      if (m.id === user.id) break;
    }
    stickToBottomRef.current = true;
    await runCompletion(conversation.id, history, user.id);
  }

  function versionMeta(message: Message) {
    const sibs = siblingsOf(allMessages, message);
    const index = Math.max(0, sibs.findIndex((m) => m.id === message.id));
    return {
      index: index + 1,
      count: sibs.length,
      prevId: index > 0 ? sibs[index - 1]?.id : undefined,
      nextId: index < sibs.length - 1 ? sibs[index + 1]?.id : undefined,
    };
  }

  const empty = messages.length === 0;

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void ingestFiles(e.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-none bg-background/80">
          <p className="rounded-2xl border border-border bg-card px-5 py-3 text-sm">
            Drop files to attach
          </p>
        </div>
      ) : null}
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
        <ModelPicker
          models={models}
          value={selectedModel}
          onChange={requestSwitch}
          onBrowse={onBrowseModels}
        />
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
            {messages.map((message) => {
              const version = versionMeta(message);
              return (
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
                  versionIndex={version.index}
                  versionCount={version.count}
                  onVersionPrev={
                    version.prevId && conversation && !streamingId
                      ? () => selectSibling(conversation.id, version.prevId!)
                      : undefined
                  }
                  onVersionNext={
                    version.nextId && conversation && !streamingId
                      ? () => selectSibling(conversation.id, version.nextId!)
                      : undefined
                  }
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {switchWarn ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              {switchWarn.name} has a smaller context window ({switchWarn.used.toLocaleString()}{" "}
              tokens in this chat, {switchWarn.limit.toLocaleString()} available). The full
              conversation is still passed over, but answers may be unexpected or inaccurate while
              the window is full.
            </p>
            <Button className="h-10 shrink-0" onClick={onNewChat}>
              New chat
            </Button>
          </div>
        </div>
      ) : null}

      {fileHint ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">{fileHint}</p>
        </div>
      ) : null}

      {contextFull && !switchWarn ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-pretty">
              This model's context window is full. You can keep chatting, but answers may be
              unexpected or inaccurate. Start a new chat to reset the window.
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
        disabled={!selectedModel}
        placeholder={
          selectedModel ? `Message ${selectedModel.name}` : "Choose a model to begin"
        }
        files={files}
        onRemoveFile={(id) => setFiles((cur) => cur.filter((f) => f.id !== id))}
        onPickFiles={() => undefined}
        accept={fileAccept}
        onFileInput={(list) => {
          if (list) void ingestFiles(list);
        }}
      />
      <Dialog open={Boolean(pendingModel)} onOpenChange={(open) => !open && setPendingModel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This model has a smaller context window</DialogTitle>
            <DialogDescription>
              {pendingModel
                ? `${pendingModel.name} can hold about ${(pendingModel.contextLength ?? 0).toLocaleString()} tokens. This chat is already using ${(conversation?.contextTokens ?? 0).toLocaleString()} tokens. The whole conversation will still be sent, but answers may be unexpected or inaccurate because the new context window is full.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingModel(null)}>
              Keep current model
            </Button>
            <Button
              onClick={() => {
                if (pendingModel) applyModel(pendingModel);
                setPendingModel(null);
              }}
            >
              Switch anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
