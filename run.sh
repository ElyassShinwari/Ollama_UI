#!/bin/sh
set -eu
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Ollama UI needs Node.js 22 or newer (with npm)."
  echo "Install it from https://nodejs.org then run: make run"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Ollama UI…"
  npm install
fi

port_in_use() {
  node -e '
    const net = require("net");
    const port = Number(process.argv[1]);
    const server = net.createServer();
    server.once("error", () => process.exit(0));
    server.once("listening", () => server.close(() => process.exit(1)));
    server.listen(port, "127.0.0.1");
  ' "$1"
}

looks_like_us() {
  node -e '
    const port = process.argv[1];
    fetch("http://127.0.0.1:" + port, { signal: AbortSignal.timeout(800) })
      .then(async (res) => {
        const text = await res.text();
        const hit = /Ollama UI|ollama-ui|Ollama_UI/i.test(text);
        process.exit(hit ? 0 : 1);
      })
      .catch(() => process.exit(1));
  ' "$1"
}

PORT="${PORT:-8080}"

if port_in_use "$PORT"; then
  if looks_like_us "$PORT"; then
    echo "Ollama UI is already running at http://127.0.0.1:${PORT}"
    echo "Open that address in your browser."
    exit 0
  fi
  START=$PORT
  PORT=$((PORT + 1))
  while port_in_use "$PORT"; do
    PORT=$((PORT + 1))
    if [ "$PORT" -gt $((START + 40)) ]; then
      echo "Could not find a free port near ${START}."
      echo "Stop the other program using that port, or run: PORT=3000 make run"
      exit 1
    fi
  done
  echo "Port ${START} is already in use. Using ${PORT} instead."
fi

echo "Starting Ollama UI at http://127.0.0.1:${PORT}"
echo "Leave this terminal open. Open that address in your browser."
echo "Start Ollama, then pick a local model (smollm2:135m is a good first one)."
exec npm run dev -- --host 0.0.0.0 --port "$PORT" --strictPort false
