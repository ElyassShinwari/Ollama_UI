export type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechResultEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export function speechRecognitionCtor(): (new () => SpeechRec) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechInputAvailable() {
  return Boolean(
    typeof window !== "undefined" && window.isSecureContext !== false && speechRecognitionCtor(),
  );
}

export function speechInputBlockedReason(): "https" | "browser" | "unavailable" | null {
  if (typeof window === "undefined") return "unavailable";
  if (window.isSecureContext === false) return "https";
  if (!speechRecognitionCtor()) return "browser";
  return null;
}

export function joinDraft(base: string, spoken: string) {
  const a = norm(base);
  const b = norm(spoken);
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

function norm(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function fold(text: string) {
  return norm(text)
    .toLowerCase()
    .replace(/[.,!?;:…"“”‘’'"`_\-–—()[\]{}]/g, "")
    .replace(/[\u060C\u061B\u061F\u06D4]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateUtterance(prev: string, next: string) {
  const a = fold(prev);
  const b = fold(next);
  if (!b) return true;
  if (!a) return false;
  if (b === a) return true;
  if (a.includes(b) && b.length >= 4) return true;
  return false;
}

/** If the recognizer pasted the same phrase several times, keep one copy. */
export function collapseRepeatedSpeech(text: string) {
  const words = norm(text).split(" ").filter(Boolean);
  if (words.length < 2) return words.join(" ");
  for (let n = 1; n <= Math.floor(words.length / 2); n++) {
    const unit = words.slice(0, n);
    let copies = 1;
    let i = n;
    while (i + n <= words.length && unit.every((w, k) => words[i + k] === w)) {
      copies += 1;
      i += n;
    }
    const rest = words.slice(i);
    const restIsPrefix = rest.every((w, k) => w === unit[k]);
    if (copies >= 2 && restIsPrefix) {
      if (n === 1 && copies < 3) continue;
      return unit.join(" ");
    }
  }
  return words.join(" ");
}

/**
 * Combine two speech chunks without doubling.
 * Handles extension ("hello" + "hello world"), overlap, and full repeats.
 */
export function mergeSpoken(existing: string, incoming: string) {
  const a = norm(existing);
  const b = norm(incoming);
  if (!b) return a;
  if (!a) return collapseRepeatedSpeech(b);
  const al = fold(a);
  const bl = fold(b);
  if (!bl) return a;
  if (al === bl) return a.length >= b.length ? a : b;
  if (bl.startsWith(al) || al.startsWith(bl)) {
    return collapseRepeatedSpeech(al.length >= bl.length ? a : b);
  }
  if (al.includes(bl) && bl.length >= 6) return collapseRepeatedSpeech(a);
  if (bl.includes(al) && al.length >= 6) return collapseRepeatedSpeech(b);

  const aw = a.split(" ");
  const bw = b.split(" ");
  const maxW = Math.min(aw.length, bw.length);
  for (let n = maxW; n >= 1; n--) {
    if (aw.slice(-n).join(" ").toLowerCase() === bw.slice(0, n).join(" ").toLowerCase()) {
      return collapseRepeatedSpeech(norm([...aw, ...bw.slice(n)].join(" ")));
    }
  }

  const maxC = Math.min(a.length, b.length);
  for (let n = maxC; n >= 4; n--) {
    if (a.slice(-n).toLowerCase() === b.slice(0, n).toLowerCase()) {
      return collapseRepeatedSpeech(norm(a + b.slice(n)));
    }
  }

  return collapseRepeatedSpeech(joinDraft(a, b));
}

export function spokenFromResults(ev: SpeechResultEvent) {
  let out = "";
  const len = ev.results.length;
  for (let i = 0; i < len; i++) {
    const piece = norm(ev.results[i]?.[0]?.transcript ?? "");
    if (piece) out = mergeSpoken(out, piece);
  }
  return collapseRepeatedSpeech(out);
}

export function transcriptFromSpeechEvent(ev: SpeechResultEvent) {
  return spokenFromResults(ev);
}

export function createSpeechDraft(base: string) {
  const prefix = norm(base);
  return {
    beginUtterance() {},
    apply(ev: SpeechResultEvent) {
      return joinDraft(prefix, spokenFromResults(ev));
    },
  };
}
