const CHAT_TTL_MS = 8_000;

let chatUntil = 0;
let n8nRunning = false;
let n8nAbort: AbortController | null = null;

export function setChatBusy(on: boolean) {
  if (on) {
    chatUntil = Date.now() + CHAT_TTL_MS;
    n8nAbort?.abort();
    return;
  }
  chatUntil = 0;
}

export function chatIsBusy() {
  return Date.now() < chatUntil;
}

export function enterN8n(): { ok: true; signal: AbortSignal } | { ok: false; retryMs: number } {
  if (chatIsBusy()) return { ok: false, retryMs: 2_000 };
  if (n8nRunning) return { ok: false, retryMs: 1_000 };
  n8nRunning = true;
  n8nAbort = new AbortController();
  return { ok: true, signal: n8nAbort.signal };
}

export function leaveN8n() {
  n8nRunning = false;
  n8nAbort = null;
}

export function n8nLaneBusy() {
  return n8nRunning;
}

/** Test helper — do not call from app code. */
export function resetLaneForTests() {
  chatUntil = 0;
  n8nRunning = false;
  n8nAbort = null;
}
