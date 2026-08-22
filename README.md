# Ollama_UI

A ChatGPT-style app for models on your computer and in the cloud.

Talk to Ollama models, ChatGPT, Claude, Grok, and Kimi in one window. Install Ollama and models from the app, keep chats in the browser, and send one model’s answer to another for review.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (includes npm)

Ollama is required for **local** models. Cloud models only need an API key (OpenAI, Anthropic, xAI, or Moonshot).

## Install and run

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

1. Open Ollama_UI. Install Ollama if you want local models, or skip to a cloud model.
2. Pick a model from the library, from this computer, or from ChatGPT / Claude / Grok / Kimi.
3. Chat. Switch models from the header. The full conversation is sent to the new model, and the context meter updates to that model's window.
4. If the new model’s window is smaller than this chat, you get a warning: answers may be unexpected or inaccurate while the window is full. You can still continue, or start a new chat.
5. Attach `.txt` files with **+** or drag and drop. Vision models also take images.
6. Open **Studio** in the sidebar for GitHub, cloud APIs, MCP, the local API, website/WhatsApp webhooks, instructions, knowledge, and model advice. **Back to new chat** closes Studio and opens a blank conversation.
7. Turn on **Review cycle** in a chat to have one model write and another review. Choose both models and 1–100 cycles. The cycle stops early if the reviewer starts with `SATISFIED`.

Conversations stay in this browser. Default theme is light (switch in Settings). API keys stay in this browser and are sent only to this computer’s server, then to the matching provider.

## Cloud models (ChatGPT, Claude, Grok, Kimi)

Paste keys in **Settings** or **Studio → Cloud**:

| Provider | Key from | Models in the picker |
| --- | --- | --- |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | ChatGPT / GPT |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Claude |
| xAI | [console.x.ai](https://console.x.ai) | Grok |
| Moonshot | [platform.moonshot.ai](https://platform.moonshot.ai) | Kimi |

After you save, those models appear in the same menu as Ollama. You can mix them in one chat, including as the two sides of a review cycle.

## Review cycle

1. Open a chat and turn on **Review cycle**.
2. **First** is the writer. **Second** is the reviewer. They must be different models.
3. Set **Cycles** from 1 to 100.
4. Send a prompt. Each cycle: the writer answers, the reviewer checks it, then the writer revises from that review.
5. If the reviewer starts its reply with `SATISFIED`, the loop stops. **Stop** cancels the rest of the run.

Replies are labeled with the model that wrote them.

## Studio

Studio is for connecting this computer to other software. It does **not** log into Instagram or WhatsApp for you, and Ollama **cannot fine-tune weights while you chat**.

### GitHub

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with **repo** access (`ghp_…` or `github_pat_…`).
2. Paste it in **Studio → GitHub** and click **Authenticate**.
3. Paste `owner/repo` or a GitHub URL and click **Pull repository**. git must be installed. Copies land in `data/repos`.
4. To open a pull request, fill owner, repo, head branch, base branch, and title, then **Open pull request**. Use **Use for PR** on a cloned repo to fill owner and repo.

This app does not do GitHub OAuth in the browser. The token stays in this browser and is sent only to GitHub.

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

**No local models listed**  
Install one from the library search (`smollm2:135m`). If Ollama is on another machine, set the host in Settings (`http://127.0.0.1:11434` by default).

**ChatGPT / Claude / Grok / Kimi missing**  
Paste the matching API key in Settings or Studio → Cloud, then wait a moment. Bad or empty keys are not listed.

**GitHub authenticate failed**  
The token needs **repo** access. Fine-grained tokens must allow the target repository. This app does not use GitHub OAuth.

**Review cycle does nothing**  
Pick two different models (first and second) and turn the checkbox on before you send.

**Node not found**  
Install Node.js 22+ from [nodejs.org](https://nodejs.org), then `make run`.
