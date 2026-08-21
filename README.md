# Ollama_UI

A ChatGPT-style chat app for the Ollama models already on your computer.

It lists every model you have downloaded, lets you switch models in the chat header, saves conversations in the browser, and shows each model’s context window.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (includes npm)
- [Ollama](https://ollama.com)

## Install Ollama

### Windows

1. Download the installer from [ollama.com/download](https://ollama.com/download).
2. Run it and finish setup. Ollama starts in the background (system tray).
3. Open **PowerShell** or **Command Prompt** and check:

```powershell
ollama --version
```

You can also install with winget:

```powershell
winget install Ollama.Ollama
```

### macOS

Install with Homebrew:

```bash
brew install ollama
brew services start ollama
```

Or download the Mac app from [ollama.com/download](https://ollama.com/download) and open it.

Check:

```bash
ollama --version
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Then start the service if it is not already running:

```bash
ollama serve
```

Leave that terminal open, or enable the systemd service if your install created one. Check:

```bash
ollama --version
```

## Download a model

Ollama_UI talks to models you already pulled. These two SmolLM2 models are small and run on almost any computer:

```bash
ollama pull smollm2:135m
ollama pull smollm2:360m
```

`smollm2:135m` is the lightest (~100 MB class). `smollm2:360m` is a bit stronger and still fine on a laptop with no GPU.

Confirm they are there:

```bash
ollama list
```

Try one in the terminal (optional):

```bash
ollama run smollm2:135m "Say hello in one sentence."
```

Type `/bye` to leave that terminal chat. You do not need it once Ollama_UI is running.

## Install and run Ollama_UI

```bash
git clone https://github.com/YOUR_USER/Ollama_UI.git
cd Ollama_UI
make run
```

`make run` installs npm packages the first time, then starts the app. Later runs only start it.

If `make` is not installed:

```bash
chmod +x run.sh
./run.sh
```

On Windows, Git Bash can run the same commands. From Command Prompt you can use:

```bat
run.cmd
```

When it is ready, open the address it prints (usually http://127.0.0.1:8080). If 8080 is already taken, it picks the next free port.

### If you already installed it

From the project folder:

```bash
make run
```

That is enough. It will not reinstall unless `node_modules` is missing.

To install packages only:

```bash
make install
```

## Use it

1. Keep Ollama running.
2. Open Ollama_UI in your browser.
3. Pick a model (`smollm2:135m` or whatever you pulled).
4. Chat. Switch models from the dropdown at the top of a chat.
5. Conversations stay in this browser.

If no models show up, click **Refresh** or **This PC**, or set the Ollama host in **Settings** (default `http://127.0.0.1:11434`).

## Troubleshooting

**Port already in use**  
Ollama_UI now skips a busy port. If you still want 8080, stop the other program using it, then `make run` again.

**No models listed**  
Run `ollama list`. If it is empty, pull a model. If Ollama is on another machine, paste that host in Settings.

**Node not found**  
Install Node.js 22+ from [nodejs.org](https://nodejs.org), then run `make run` again.
