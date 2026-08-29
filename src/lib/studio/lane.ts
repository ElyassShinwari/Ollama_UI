let timer: number | null = null;

function ping(busy: boolean) {
  if (typeof fetch === "undefined") return;
  void fetch("/api/n8n/lane", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat: busy }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Tell the server the user is (or is not) using the local model, so n8n can wait. */
export function setChatLane(busy: boolean) {
  ping(busy);
  if (typeof window === "undefined") return;
  if (busy) {
    if (timer == null) timer = window.setInterval(() => ping(true), 4000);
    return;
  }
  if (timer != null) {
    window.clearInterval(timer);
    timer = null;
  }
}
