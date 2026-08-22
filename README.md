# Ollama_UI

A ChatGPT-style app for models on your computer and in the cloud.

Talk to Ollama models, ChatGPT, Claude, Grok, Kimi, and DeepSeek in one window. Install Ollama and models from the app, keep chats in the browser, and send one model’s answer to another for review.

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (includes npm)

Ollama is required for **local** models. Cloud models need a sign-in (ChatGPT, Grok, Kimi) or an API key (Claude, DeepSeek, or any of the five).

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
2. Pick a model from the library, from this computer, or from ChatGPT / Claude / Grok / Kimi. Open the model menu to search and scroll the full list, or use the arrows to step through every available model. The tester menu in a review works the same way.
3. Chat. Switch models from the header. The full conversation is sent to the new model, and the context meter updates to that model's window. Delete a chat from the trash icon in the sidebar history, from **⋯ → Delete**, or from the trash in the chat header. Confirm, and it is removed from this browser.
4. If the new model’s window is smaller than this chat, you get a warning: answers may be unexpected or inaccurate while the window is full. You can still continue, or start a new chat.
5. Attach files with **+** or drag and drop. The app takes the file and sends what it can (text, images, PDFs, and other types). Grok files go through xAI’s Responses API. ChatGPT, Claude, and Kimi accept many kinds too. If a model cannot read a file, that model’s reply says so — the app does not block unknown types up front.
6. Open **Studio** in the sidebar for GitHub, **Cloud base**, MCP, the local API, website/WhatsApp webhooks, instructions, knowledge, and model advice. **Back to chat** closes Studio and returns to the conversation you were in. Clicking a chat in the sidebar also closes Studio and opens that chat.
7. Click **Start review** to run a writer/tester cycle on the current chat — including chats you already started. The **writer** is the model in the header. Pick a **tester** and 1–100 cycles. If the tester is not satisfied when the cycles end, it posts a final report with the project and remaining errors.

Conversations stay in this browser. Default theme is light (switch in Settings). API keys stay in this browser and are sent only to this computer’s server, then to the matching provider.

## Cloud base (ChatGPT, Claude, Grok, Kimi, DeepSeek)

**Settings** or **Studio → Cloud base**:

- **ChatGPT** — click **Sign in**. A ChatGPT window opens (normal login, not a device code). You do **not** need to enable device-code authorization in ChatGPT Security Settings. If the browser then says it cannot connect, copy the full address from the address bar (`http://localhost:1455/auth/callback?code=…`) and paste it into Cloud base, then **Finish**. After you are signed in, pick a **ChatGPT** model (GPT-5.4 or Codex). That uses your ChatGPT plan. A platform API key is a separate paid bill and is not needed for sign-in.
- **Grok** — click **Sign in**, approve in the window, enter the code if asked.
- **Kimi** — click **Sign in**, approve in the window, enter the code if asked.
- **Claude** and **DeepSeek** — those companies do not allow other apps to use a web login. Sign in on their site, then paste an API key.

| Provider | In-app sign-in | API key |
| --- | --- | --- |
| ChatGPT | Yes — Sign in in Cloud base | Optional, [platform.openai.com](https://platform.openai.com/api-keys) |
| Grok | Yes — Sign in in Cloud base | Optional, [console.x.ai](https://console.x.ai) |
| Kimi | Yes — Sign in in Cloud base | Optional, [platform.moonshot.ai](https://platform.moonshot.ai) |
| Claude | No (Anthropic policy) | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| DeepSeek | No | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |

Signed-in accounts and keys stay in this browser. Review cycles can use any connected model as writer or tester.

## Review cycle

1. Open any chat (new or already started) and pick a **tester** different from the model in the header.
2. The **writer** is the model in the header. Switch that model anytime — the next cycle uses the new one (Ollama, ChatGPT, Claude, Grok, Kimi, or DeepSeek).
3. Set **Cycles** from 1 to 100.
4. Click **Start review**. If the last message is already an answer, the tester reviews it first. If you typed a prompt, that is sent, then the cycle runs. Works mid-conversation.
5. Each cycle: the writer’s full reply is passed to the tester, the tester’s full reply is passed back to the writer.
6. If the tester starts with `SATISFIED`, the loop stops. **Stop** cancels the rest of the run.
7. If the cycles finish and the tester is still not satisfied, the tester writes a **final report** that includes the current project and the remaining errors.

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

**ChatGPT / Claude / Grok / Kimi / DeepSeek missing**  
Open **Studio → Cloud base** (or Settings). ChatGPT, Grok, and Kimi: click **Sign in**. If ChatGPT talks about enabling device-code in Security Settings, close that tab and use **Sign in** again — this app uses the normal ChatGPT login, not device-code. Claude and DeepSeek need an API key from their console.

**ChatGPT says insufficient quota**  
That is the paid OpenAI API, not your ChatGPT plan. Sign in with ChatGPT in Cloud base (do not paste a platform API key), then pick a ChatGPT GPT-5.4 or Codex model.

**Kimi says invalid temperature**  
Kimi Code only accepts temperature 1. The app now sends that automatically after you sign in with Kimi.

**GitHub authenticate failed**  
The token needs **repo** access. Fine-grained tokens must allow the target repository. This app does not use GitHub OAuth.

**Review cycle does nothing**  
Pick a **tester** different from the model in the header, then click **Start review**. Works on a chat that already has messages.

**Node not found**  
Install Node.js 22+ from [nodejs.org](https://nodejs.org), then `make run`.

## License

Copyright (c) 2026 Elyass Shinwari.

Ollama_UI is free to use, copy, and modify under an MIT-style grant. See [LICENSE](LICENSE).

Commercial use is free up to 1,000,000 users. If a commercial product or service that includes this software has more than 1,000,000 users, you must ask Elyass Shinwari for extra permission.
