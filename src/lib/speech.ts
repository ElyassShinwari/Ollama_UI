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
  const a = base.trim();
  const b = spoken.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

function norm(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function isDuplicateUtterance(prev: string, next: string) {
  const a = norm(prev).toLowerCase();
  const b = norm(next).toLowerCase();
  if (!b) return true;
  if (!a) return false;
  if (b === a) return true;
  if (a.endsWith(b) && b.length >= 4) return true;
  if (b.startsWith(`${a} ${a}`)) return true;
  return false;
}

/** If the recognizer pasted the same phrase 2–5 times, keep one copy. */
export function collapseRepeatedSpeech(text: string) {
  const words = norm(text).split(" ").filter(Boolean);
  if (words.length < 4) return words.join(" ");
  const maxUnit = Math.floor(words.length / 2);
  for (let n = 1; n <= maxUnit; n++) {
    if (words.length % n !== 0) continue;
    const copies = words.length / n;
    if (copies < 2) continue;
    const unit = words.slice(0, n);
    const unitText = unit.join(" ");
    if (unitText.length < 8 && n < 2) continue;
    let tiles = true;
    for (let i = 0; i < words.length; i++) {
      if (words[i] !== unit[i % n]) {
        tiles = false;
        break;
      }
    }
    if (tiles) return unitText;
  }
  return words.join(" ");
}

export function transcriptFromSpeechEvent(ev: SpeechResultEvent) {
  let finals = "";
  let interim = "";
  const start = Math.max(0, ev.resultIndex);
  for (let i = start; i < ev.results.length; i++) {
    const piece = norm(ev.results[i]?.[0]?.transcript ?? "");
    if (!piece) continue;
    if (ev.results[i]!.isFinal) finals = joinDraft(finals, piece);
    else interim = piece;
  }
  return collapseRepeatedSpeech(joinDraft(finals, interim));
}

export function createSpeechDraft(base: string) {
  let finals = "";
  let lastFinal = "";
  let seen = 0;
  const prefix = norm(base);
  return {
    beginUtterance() {
      seen = 0;
    },
    apply(ev: SpeechResultEvent) {
      let interim = "";
      const start = Math.max(ev.resultIndex, seen);
      for (let i = start; i < ev.results.length; i++) {
        const piece = norm(ev.results[i]?.[0]?.transcript ?? "");
        if (!piece) continue;
        if (ev.results[i]!.isFinal) {
          seen = i + 1;
          if (isDuplicateUtterance(lastFinal, piece) || isDuplicateUtterance(finals, piece)) continue;
          finals = joinDraft(finals, piece);
          lastFinal = piece;
        } else {
          if (isDuplicateUtterance(lastFinal, piece) || isDuplicateUtterance(finals, piece)) continue;
          interim = piece;
        }
      }
      return joinDraft(prefix, collapseRepeatedSpeech(joinDraft(finals, interim)));
    },
  };
}
