import { fetchSetup, readSetupStream } from "@/lib/llm/setup";

export async function pullOllamaModel(
  host: string,
  model: string,
  onProgress?: (percent: number) => void,
): Promise<boolean> {
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
    },
    onProgress,
  );
}
