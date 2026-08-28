import type { Message } from "./types";

const LEGACY_NOTE =
  /^(Cycle\s+\d+\s*\/\s*\d+\s*·\s+|Finished by\s+)/i;

export function isNoteMessage(message: Pick<Message, "role" | "content" | "images" | "documents" | "attachments">) {
  if (message.role === "note") return true;
  if (message.role !== "user") return false;
  if (message.images?.length || message.documents?.length || message.attachments?.length) return false;
  return LEGACY_NOTE.test(message.content.trim());
}

export function chatTurnsOf(messages: Message[]) {
  return messages.filter((m) => !isNoteMessage(m) && (m.role === "user" || m.role === "assistant"));
}

export function childrenOf(messages: Message[], parentId: string | null): Message[] {
  return messages.filter((m) => (m.parentId ?? null) === parentId);
}

export function visibleMessages(messages: Message[], activeRootId?: string | null): Message[] {
  if (messages.length === 0) return [];
  const roots = childrenOf(messages, null);
  let current =
    (activeRootId ? roots.find((m) => m.id === activeRootId) : undefined) ?? roots[0];
  if (!current && messages[0]) {
    // Legacy linear threads before parentId existed.
    return messages;
  }
  const out: Message[] = [];
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    out.push(current);
    const kids = childrenOf(messages, current.id);
    if (kids.length === 0) break;
    current =
      kids.find((k) => k.id === current!.selectedChildId) ?? kids[kids.length - 1];
  }
  return out;
}

export function siblingsOf(messages: Message[], message: Message): Message[] {
  return childrenOf(messages, message.parentId ?? null).filter((m) => m.role === message.role);
}

export function linkLinearMessages(messages: Message[]): Message[] {
  if (messages.length === 0) return messages;
  const hasTree = messages.some((m) => Boolean(m.parentId));
  if (hasTree || messages.every((m) => m.parentId === null || typeof m.parentId === "string")) {
    return messages.map((m) => ({
      ...m,
      parentId: m.parentId ?? null,
      selectedChildId: m.selectedChildId ?? null,
    }));
  }
  return messages.map((m, i) => ({
    ...m,
    parentId: i === 0 ? null : messages[i - 1]!.id,
    selectedChildId: messages[i + 1]?.id ?? null,
  }));
}
