export type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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

export function speechInputBlockedReason() {
  if (typeof window === "undefined") return "Voice input is not available here.";
  if (window.isSecureContext === false) {
    return "Voice input needs a private page (this computer as localhost, or https).";
  }
  if (!speechRecognitionCtor()) {
    return "Voice input isn’t available in this browser. Chrome, Edge, or Safari work best.";
  }
  return null;
}

export function transcriptFromSpeechEvent(ev: SpeechResultEvent) {
  const parts: string[] = [];
  const len = ev.results.length;
  for (let i = 0; i < len; i++) {
    const piece = ev.results[i]?.[0]?.transcript?.trim();
    if (piece) parts.push(piece);
  }
  return parts.join(" ");
}

export function joinDraft(base: string, spoken: string) {
  const a = base.trim();
  const b = spoken.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}
