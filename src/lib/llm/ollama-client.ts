import type { TokenUsage } from "@/lib/chat/types";

export type OllamaChatMessage = {
  role: string;
  content: string;
  images?: string[];
};

export type OllamaChatPayload = {
  model: string;
  messages: OllamaChatMessage[];
  stream: true;
  options?: Record<string, number>;
};

/** Chat body that matches `ollama run`: stream on, no extra options unless we must set num_ctx. */
export function ollamaChatPayload(
  model: string,
  messages: OllamaChatMessage[],
  options?: Record<string, number>,
): OllamaChatPayload {
  const payload: OllamaChatPayload = {
    model,
    messages: messages.map((m) => {
      const images = ollamaImages(m.images);
      return images ? { role: m.role, content: m.content, images } : { role: m.role, content: m.content };
    }),
    stream: true,
  };
  if (options && Object.keys(options).length > 0) payload.options = options;
  return payload;
}

function ollamaImages(images?: string[]) {
  if (!images?.length) return undefined;
  return images.map((img) => {
    if (!img.startsWith("data:")) return img;
    const comma = img.indexOf(",");
    return comma >= 0 ? img.slice(comma + 1) : img;
  });
}

export function parseOllamaNdjsonLine(
  line: string,
): { content?: string; error?: string; usage?: TokenUsage } | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  const json = JSON.parse(trimmed) as {
    message?: { content?: string };
    error?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };
  if (json.error) return { error: json.error };
  const content = json.message?.content;
  const promptTokens = Number(json.prompt_eval_count) || 0;
  const completionTokens = Number(json.eval_count) || 0;
  const usage =
    promptTokens || completionTokens ? { promptTokens, completionTokens } : undefined;
  if (!content && !usage) return undefined;
  return { content: content || undefined, usage };
}

export function createNdjsonParser(onEvent: (event: {
  content?: string;
  error?: string;
  usage?: TokenUsage;
}) => void) {
  let buf = "";
  const take = (line: string) => {
    try {
      const parsed = parseOllamaNdjsonLine(line);
      if (parsed) onEvent(parsed);
    } catch (err) {
      if (err instanceof SyntaxError) return;
      throw err;
    }
  };
  return {
    push(text: string) {
      buf += text;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) take(line);
    },
    end() {
      if (buf.trim()) take(buf);
      buf = "";
    },
  };
}

export function isOllamaUnreachable(err: unknown) {
  if (!err || (err as { name?: string }).name === "AbortError") return false;
  const m = err instanceof Error ? err.message : String(err);
  return /could not reach|failed to fetch|networkerror|load failed|cors|ollama error 0/i.test(m);
}

/**
 * Stream Ollama from the browser with XHR onprogress.
 * fetch().body often waits until the full reply on Android WebView / some phones.
 */
export function streamOllamaXhr(opts: {
  url: string;
  payload: OllamaChatPayload;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", opts.url);
    xhr.overrideMimeType("text/plain; charset=utf-8");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/x-ndjson");
    xhr.responseType = "text";
    let seen = 0;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const parser = createNdjsonParser((event) => {
      if (event.error) throw new Error(event.error);
      if (event.content) opts.onDelta(event.content);
      if (event.usage) opts.onUsage?.(event.usage);
    });
    const consume = () => {
      const text = xhr.responseText ?? "";
      if (text.length <= seen) return;
      parser.push(text.slice(seen));
      seen = text.length;
    };
    xhr.onprogress = () => {
      try {
        consume();
      } catch (err) {
        xhr.abort();
        finish(() => reject(err));
      }
    };
    xhr.onload = () => {
      try {
        consume();
        parser.end();
      } catch (err) {
        finish(() => reject(err));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) finish(() => resolve());
      else finish(() => reject(new Error(xhr.responseText?.trim() || `Ollama error ${xhr.status}`)));
    };
    xhr.onerror = () => finish(() => reject(new Error("Could not reach Ollama")));
    xhr.onabort = () => finish(() => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
    const onAbort = () => xhr.abort();
    if (opts.signal.aborted) {
      xhr.abort();
      return;
    }
    opts.signal.addEventListener("abort", onAbort, { once: true });
    xhr.send(JSON.stringify(opts.payload));
  });
}

/**
 * True streaming: read NDJSON chunks as Ollama produces them.
 * Does not grow a full response string the way XHR responseText does.
 */
export async function streamOllamaFetch(opts: {
  url: string;
  payload: OllamaChatPayload;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}): Promise<void> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(opts.payload),
    signal: opts.signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.trim() || `Ollama error ${res.status}`);
  }
  if (!res.body) throw new Error("Could not reach Ollama");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const parser = createNdjsonParser((event) => {
    if (event.error) throw new Error(event.error);
    if (event.content) opts.onDelta(event.content);
    if (event.usage) opts.onUsage?.(event.usage);
  });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(dec.decode(value, { stream: true }));
    }
    parser.end();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

function androidWebView() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) && /wv\)|; wv/i.test(navigator.userAgent);
}

/** Direct to Ollama: fetch stream on desktop, XHR on Android WebView. */
export async function streamOllamaDirect(opts: {
  url: string;
  payload: OllamaChatPayload;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onUsage?: (usage: TokenUsage) => void;
}): Promise<void> {
  if (androidWebView()) {
    await streamOllamaXhr(opts);
    return;
  }
  await streamOllamaFetch(opts);
}

export const ollamaGate = {
  chat: false,
};
