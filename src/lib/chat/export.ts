import type { Conversation, Message } from "./types";

const LEGACY_NOTE = /^(Cycle\s+\d+\s*\/\s*\d+\s*·\s+|Finished by\s+)/i;

function isNote(m: Pick<Message, "role" | "content">) {
  if (m.role === "note") return true;
  if (m.role !== "user") return false;
  return LEGACY_NOTE.test(m.content.trim());
}

export function conversationsBackup(conversations: Conversation[]) {
  return {
    exportedAt: new Date().toISOString(),
    app: "Ollama UI",
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      pinned: c.pinned ?? false,
      model: c.model,
      messages: c.messages.map(exportMessage),
    })),
  };
}

function exportMessage(m: Message) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    modelId: m.modelId,
    modelName: m.modelName,
    createdAt: m.createdAt,
    parentId: m.parentId ?? null,
    selectedChildId: m.selectedChildId ?? null,
    attachments: m.attachments,
  };
}

export function conversationMarkdown(conversation: Conversation) {
  const lines = [`# ${conversation.title}`, ""];
  for (const m of conversation.messages) {
    if (isNote(m)) {
      lines.push(`*${m.content}*`, "");
      continue;
    }
    const who = m.role === "user" ? "You" : m.modelName || "Assistant";
    lines.push(`## ${who}`, "", m.content || "", "");
  }
  return lines.join("\n").trim() + "\n";
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
