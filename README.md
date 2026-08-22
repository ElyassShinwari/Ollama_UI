# Ollama_UI

A chat app for Ollama models on your computer.

It can install Ollama for you, search the model library, and download a model with one click. You can switch models in the middle of a chat. Conversations, context use, light/dark theme, and file attachments (.txt always, images on vision models) stay in the browser.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (includes npm)

Ollama is required to chat. You can install it from the app, or by hand as shown below.

## Install and run Ollama_UI

```bash
git clone https://github.com/ElyassShinwari/Ollama_UI.git
cd Ollama_UI
make run
```

`make run` installs npm packages the first time, then starts the app. Open the address it prints (usually http://127.0.0.1:8080). If 8080 is busy, it picks the next free port.

If `make` is missing:

```bash
chmod +x run.sh
./run.sh
```

On Windows, Git Bash can run the same commands. From Command Prompt:

```bat
run.cmd
```

Later runs only start the app:

```bash
make run
```

## Install Ollama from the app

When you open Ollama_UI, it checks this computer:

1. If Ollama is missing, it shows **Install Ollama** for your OS (Windows, macOS, or Linux) and runs the installer.
2. If Ollama is installed but not running, click **Start Ollama**.
3. Search for a model (try `smollm2:135m` or `smollm2:360m`) and click **Install & run**. That downloads it and opens a chat.

You can also open **Install a model** from the model menu in an existing chat.

These two SmolLM2 models run on almost any computer:

- `smollm2:135m` — smallest, good first test
- `smollm2:360m` — a bit stronger, still light

## Install Ollama by hand (optional)

Use this if the in-app installer cannot get permission on your machine.

### Windows

Download from [ollama.com/download](https://ollama.com/download), or:

```powershell
winget install Ollama.Ollama
ollama --version
```

### macOS

```bash
brew install ollama
brew services start ollama
ollama --version
```

Or install the Mac app from [ollama.com/download](https://ollama.com/download).

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

Keep that terminal open, or enable the service if the installer created one.

### Pull a model in the terminal

```bash
ollama pull smollm2:135m
ollama pull smollm2:360m
ollama list
```

## Use it

1. Open Ollama_UI and wait until Ollama is running.
2. Search the library, install a model, or pick one already on this computer.
3. Chat. Switch models from the header. The full conversation is sent to the new model, and the context meter updates to that model's window.
4. If the new model’s window is smaller than this chat, you get a warning: answers may be unexpected or inaccurate while the window is full. You can still continue, or start a new chat.
5. Attach `.txt` files with **+** or drag and drop. Vision models also take images.
6. Open **Studio** in the sidebar for GitHub, MCP, the local API, website/WhatsApp webhooks, instructions, knowledge, and model advice.

Conversations stay in this browser. Default theme is light (switch in Settings).

## Studio

Studio is for connecting this computer to other software. It does **not** log into Instagram or WhatsApp for you, and Ollama **cannot fine-tune weights while you chat**.

### GitHub

Paste `owner/repo` or a GitHub URL and click **Pull repository**. Private repos need a token. git must be installed. Copies land in `data/repos`.

### MCP

Add an MCP server (stdio command or HTTP URL), or **Create an MCP server** to write a starter `server.js`. Tool-calling models: qwen2.5, llama3.1, llama3.2. Tiny chat models usually cannot use tools.

### Local API

Enable the OpenAI-style endpoint so other programs can call your model:

`POST /api/v1/chat/completions`

Use the API key from Studio. Example is shown in the app.

### Website, WhatsApp, Instagram

Studio gives a website snippet and a webhook at `/api/channel`. Point Meta WhatsApp Cloud API (and Instagram Messaging, same shape) at that URL with the verify token. The machine running Ollama_UI must be reachable, or use a tunnel. Weak models are a poor public bot — Advisor lists stronger ones.

### Instructions and training

Enabled instruction presets are prepended to every reply (chat, API, and channels).

**Training:** Ollama does not train in place. You can:

- Save text or chats as **knowledge** (RAG — shown to the model as context)
- **Export chats as JSONL** and fine-tune Llama / Qwen / Phi / Gemma / SmolLM2 with Unsloth or LLaMA-Factory, then import a GGUF

Vision models cannot be trained here. Advisor lists which model to pull for chat, code, images, tools, and tiny PCs.

## Troubleshooting

**Port already in use**  
Ollama_UI skips a busy port. To force another: `PORT=3000 make run`.

**Install Ollama failed**  
The app needs permission to install software. Use the manual steps above, then click **Start Ollama**.

**No models listed**  
Install one from the library search (`smollm2:135m`). If Ollama is on another machine, set the host in Settings (`http://127.0.0.1:11434` by default).

**Node not found**  
Install Node.js 22+ from [nodejs.org](https://nodejs.org), then `make run`.
