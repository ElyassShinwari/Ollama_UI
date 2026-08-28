import { fetchSetup, readSetupStream } from "./setup";

export async function pullOllamaModel(
  host: string,
  model: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const status = await fetchSetup(host);
  if (!status.running) {
    throw new Error("Start Ollama first, then install the models.");
  }
  return readSetupStream(
    "/api/pull",
    () => {},
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, model }),
      signal,
    },
    onProgress,
  );
}
