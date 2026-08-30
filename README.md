# Ollama_UI

A UI for Ollama.

Talk to local models on this computer. Install Ollama and models from the app, keep chats in the browser, and send one model’s answer to another for review. Cloud models can be added in Studio.

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
3. Search for a family name such as `qwen` or `llama` — the app suggests queries as you type and lists **every matching model** from the Ollama library and Hugging Face, not only the ones already on this computer. Click **Install & run**. You can also paste a Hugging Face, ModelScope, or Ollama link.

You can also open **Install or remove models** from the model menu in an existing chat. If the menu search only shows models you already have, choose **Search library for “qwen”** (or whatever you typed) to see the rest.

These two SmolLM2 models run on almost any computer:

- `smollm2:135m` — smallest, good first test
- `smollm2:360m` — a bit stronger, still light

## Find and install local models

Ollama_UI is not limited to the official Ollama catalog. With Ollama running, search installs:

- **Ollama library** — `qwen`, `llama3.2`, `gemma3`, and the rest of ollama.com
- **Hugging Face GGUF** — any GGUF repo Ollama can pull as `hf.co/org/repo` (Unsloth, bartowski, lmstudio-community, and others)
- **Pasted links** — Hugging Face model pages or files, Ollama library URLs, or ModelScope pages that have a Hugging Face GGUF mirror

Type `qwen` (you do not need the exact tag). Suggestions appear before you finish the word. The list includes Qwen2.5, Qwen2.5-Coder, Qwen3, Hugging Face GGUF builds, and more. Pick a size, or on Hugging Face use **More sizes** for extra quants such as Q4_K_M.

While a model downloads, the percent stays in the log at the top and in an **Installing** list when you reopen **Install or remove models**. Closing that window does not stop the download. The shadow line and percent fill only that exact size (for example `smollm2:135m`, not the whole SmolLM2 group), so you can install 135m and 360m at the same time and see each one. At 100% that size’s label changes color.

The runtime is still Ollama: Hugging Face GGUF files are downloaded through it and then chat like any other local model.

**Review pairs** (Coding, Writing, Math, Science, Translation, Research, Everyday chat, Images) suggest two local models: a writer and a tester. Each job has four sizes — **very light**, **light**, **medium**, **heavy** — plus **Same model**, so the writer can review its own work. Tap **Install both** to download the pair (Ollama must be running). If one of the two is already on this computer, the button names the missing model instead — for example **Install deepseek-coder:1.3b**. Closing the pair list or **Install or remove models** does **not** stop the download — it keeps going on this computer in the background, and you can keep chatting with other models. Open **Install or remove models** again to see a live percent for each model still installing (also shown above the message box while you chat). The **×** on a downloading model stops only that install. If the tester is still not satisfied on the last cycle, that tester finishes the answer itself.

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

1. Open Ollama_UI. If Ollama is not running, a large **Start Ollama** button is in the middle of the first screen — tap it. If Ollama is not installed, that button installs it. Cloud models can still be used without it. After Ollama is installed (or started) successfully, a **New chat** opens on its own — you do not have to create one. Pick a model from the header menu (or from the list that opens if none are installed yet).
2. Pick a model from the library, from Hugging Face GGUF, from this computer, or from ChatGPT / Claude / Grok / Kimi. Search suggests names as you type (`qwen` lists every available Qwen, not only ones already installed). Open the model menu to search and scroll the full list, or use the arrows to step through every available model. The tester menu in a review works the same way.
3. Chat. Type, or tap the **mic** and speak — words land in the box so you can edit them, then send. Tokens appear as Ollama writes them — the same speed as `ollama run` in a terminal. The app does not reload the model or force a huge context window on every send. Switch models from the header — the previous local model is unloaded first so two models are not held in RAM at once. The full conversation is sent to the new model, and the context meter updates to that model's own window (read from the model; if a model never published one, the app estimates from its parameter size). Delete a chat from the trash in the sidebar history, or from **⋯ → Delete**. Confirm, and it is removed from this browser.
4. If the new model’s window is smaller than this chat, you get a warning: answers may be unexpected or inaccurate while the window is full. You can still continue, or start a new chat.
5. Attach files with **+** or drag and drop. The app takes the file and sends what it can (text, images, PDFs, and other types). Follow-up messages keep their attachments. Grok files go through xAI’s Responses API (assistant turns use `output_text`). ChatGPT, Claude, and Kimi accept many kinds too. If a model cannot read a file, that model’s reply says so — the app does not block unknown types up front.
6. Open **News** in the sidebar. Choose **Local AI**, **Overall AI**, **Pictures**, or **Videos**. Stories open in a new tab; videos play in the page. **Back to chat** closes News. Clicking a chat also closes it.
7. Open **Studio** in the sidebar for GitHub, **n8n**, **Cloud base**, MCP, the local API, website/WhatsApp webhooks, instructions, knowledge, and model advice. **Back to chat** closes Studio and returns to the conversation you were in. Clicking a chat in the sidebar also closes Studio and opens that chat.
8. Click **Start review** to run a writer/tester cycle on the current chat — including chats you already started. The **writer** is the model in the header. A **tester** is picked automatically when another model is available (you can change it). Set 1–100 cycles. Each cycle passes the latest answer between the two models. If the tester is still not satisfied when the cycles end, it posts a final report with the project and remaining errors.

Default theme is light (switch in the left menu or Settings). Change the language from the **Language** button in the top bar (it shows that language’s flag and name), from the grid on the first screen, or in Settings. English 🇬🇧, Dutch 🇳🇱, German 🇩🇪, Spanish 🇪🇸, Italian 🇮🇹, Portuguese 🇧🇷, Russian 🇷🇺, Chinese 🇨🇳, Japanese 🇯🇵, Hindi 🇮🇳, Arabic 🇸🇦, Persian 🇮🇷, Dari 🇦🇫, and Pashto 🇦🇫. Menus, buttons, and voice input follow that language (Arabic-script languages are right-to-left). API keys stay in this browser and are sent only to this computer’s server, then to the matching provider.

## On a phone

The same app is built for a phone, not only a computer.

- Open the **menu** (top corner) for New chat, News, Studio, and Settings.
- **Language** is the flag in the chat header. Tap it to see every language with its flag. The first screen, Settings, and model list follow that language (including Hindi, Japanese, and Portuguese).
- **Review** is in the chat header. It opens a sheet: tester model, cycle count, **Start review**, and the review-pair jobs (Coding, Writing, Math, and the rest).
- Studio tabs **swipe** sideways (n8n, GitHub, Cloud base, and the later tabs).
- The hardware **Back** key closes one layer at a time — language list, menu, Settings, News, Studio, Review, or a delete/rename confirm — instead of leaving the app. Tapping outside a list also closes it.
- Buttons are large enough to tap. Arabic, Persian, Dari, and Pashto put close buttons on the reading-direction side.

## News

Open **News** in the sidebar, then pick a feed:

- **Local AI** — Ollama, llama.cpp, GGUF, LM Studio, and on-device models
- **Overall AI** — labs, products, research, and policy
- **Pictures** — image models, AI art, and visual news
- **Videos** — talks and demos. Click a clip to play it in the page, or open it on YouTube.

Refresh reloads the feed. **Back to chat** (or clicking a chat) closes News.

## Cloud base (ChatGPT, Claude, Grok, Kimi, DeepSeek, and any remote API)

**Settings** or **Studio → Cloud base**:

- **ChatGPT** — click **Sign in**. A ChatGPT window opens (normal login, not a device code). You do **not** need to enable device-code authorization in ChatGPT Security Settings. If the browser then says it cannot connect, copy the full address from the address bar (`http://localhost:1455/auth/callback?code=…`) and paste it into Cloud base, then **Finish**. After you are signed in, pick a **ChatGPT** model (GPT-5.4 or Codex). That uses your ChatGPT plan. A platform API key is a separate paid bill and is not needed for sign-in.
- **Grok** — click **Sign in**, approve in the window, enter the code if asked. If sign-in fails, the app shows the error instead of waiting forever.
- **Kimi** — click **Sign in**, approve in the window, enter the code if asked.
- **Claude** and **DeepSeek** — those companies do not allow other apps to use a web login. Sign in on their site, then paste an API key.
- **Remote APIs** — any model you run on a server or in the cloud that speaks the OpenAI API (`/v1/chat/completions`). Add a name, the **Base URL** (for example `http://192.168.1.10:8000/v1` or `https://openrouter.ai/api/v1`), an **API key** if the host asks for one (leave it blank for local servers), and the **model** id. You can add more than one. **Load models** asks the server for its list. They show up under **Remote** in the model menu.

| Provider | In-app sign-in | API key |
| --- | --- | --- |
| ChatGPT | Yes — Sign in in Cloud base | Optional, [platform.openai.com](https://platform.openai.com/api-keys) |
| Grok | Yes — Sign in in Cloud base | Optional, [console.x.ai](https://console.x.ai) |
| Kimi | Yes — Sign in in Cloud base | Optional, [platform.moonshot.ai](https://platform.moonshot.ai) |
| Claude | No (Anthropic policy) | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| DeepSeek | No | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Remote / your server | No — paste the base URL | Optional. Leave blank if the server does not use a key. |

Signed-in accounts, keys, and remote URLs stay in this browser. Review cycles can use any connected model as writer or tester.

## Review cycle

1. Open any chat (new or already started) and pick a **tester** different from the model in the header.
2. The **writer** is the model in the header. Switch that model anytime — the next cycle uses the new one (Ollama, ChatGPT, Claude, Grok, Kimi, or DeepSeek).
3. Or pick a **review pair**: Coding, Writing, Math, Science, Translation, Research, Everyday chat, Images. Each job has **very light**, **light**, **medium**, and **heavy** — not a jump from tiny to huge — and **Same model** if you want the writer to review its own work. The tester is chosen for that job — a general chat model is a weak code reviewer.
4. Set **Cycles** from 1 to 100.
5. Click **Start review**. If the last message is already an answer, the tester reviews it first. If you typed a prompt, that is sent, then the cycle runs. Works mid-conversation.
6. Each cycle: the writer’s full reply is passed to the tester, the tester’s full reply is passed back to the writer.
7. If the tester starts with `SATISFIED`, the loop stops. **Stop** cancels the rest of the run.
8. If the cycles finish and the tester is still not satisfied, the tester writes a **final report** that includes the current project and the remaining errors.

Replies are labeled with the model that wrote them. In **Install or remove models**, **Review pairs** install only the models you still need. Closing that window does not cancel the download — it keeps running, and the next time you open **Install or remove models** you see how far each model has gone.

## Studio

Studio is for connecting this computer to other software. It does **not** log into Instagram or WhatsApp for you, and Ollama **cannot fine-tune weights while you chat**.

### GitHub

1. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with **repo** access (`ghp_…` or `github_pat_…`).
2. Paste it in **Studio → GitHub** and click **Authenticate**.
3. Paste `owner/repo` or a GitHub URL (trailing slash or `/tree/…` is fine) and click **Pull repository**. git must be installed. Copies land in `data/repos`. A failed clone is cleaned up so you can retry. Pulls on existing clones use your GitHub token.
4. To open a pull request, fill owner, repo, head branch, base branch, and title, then **Open pull request**. Use **Use for PR** on a cloned repo to fill owner and repo. If a new window is blocked, tap **Open** on the toast.

This app does not do GitHub OAuth in the browser. The token stays in this browser and is sent only to GitHub.

### n8n

Connect n8n on this computer, n8n Cloud, or a server, then paste a **connection** into n8n so workflows can use your local model.

1. Open **Studio → n8n**.
2. Pick where n8n lives: **This computer**, **n8n Cloud**, or **A server**. For this computer, start n8n (`npx n8n` or Docker — commands are in the app) then press **Find n8n**.
3. Optional: paste n8n’s own API key (n8n Settings → n8n API) so this app can add starter workflows for you.
4. Choose the local model n8n should use.
5. Copy the **connection** n8n asks for when you add a Self-hosted / OpenAI / Ollama Chat Model:

**Through this app** (recommended — n8n does not freeze chat)

| Field | What to paste |
| --- | --- |
| Provider | Self-hosted |
| Base URL | this app’s address + `/api/v1` (shown in the app) |
| API key | the **Fast API key** on that screen |
| Model | the local model you picked |

n8n’s Chat Model / AI Agent / OpenAI-compatible credential uses those four fields. n8n can list models from `GET /api/v1/models`. Calls skip the chat window. If you are chatting, n8n is told to wait and retry so your reply stays fast.

**Direct Ollama**

| Field | What to paste |
| --- | --- |
| Provider | Ollama |
| Base URL | `http://127.0.0.1:11434` (or the host in Settings) |
| API key | leave blank |
| Model | the same local model |

If n8n is in Docker, use the **Base URL if n8n is in Docker** field (`host.docker.internal`) — Docker cannot reach `127.0.0.1` on this computer.

You can also **Add this workflow in n8n** or download it: an HTTP Request node POSTs `{ "message": "…" }` to `/api/n8n` with `Authorization: Bearer <Fast API key>` and reads `reply`. A second workflow receives finished chats from this app (turn **Send each finished reply** on).

n8n Cloud can only *ask* a model on this computer if this app has a public address. Sending chats *into* n8n Cloud only needs the webhook.

### MCP

Add an MCP server (stdio command or HTTP URL), or **Create an MCP server** to write a starter `server.js`. Paths with spaces work as a single argument. HTTP MCP servers keep the session id. Tool-calling models: qwen2.5, llama3.1, llama3.2. Tiny chat models usually cannot use tools.

### Local API

Enable the OpenAI-style endpoint so other programs can call your **local Ollama** model:

`POST /api/v1/chat/completions`

Pick a local default model in Studio (cloud models in the chat menu are not used here). The host comes from Settings. Use the API key from Studio. Example is shown in the app.

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
The app needs permission to install software. Use the manual steps above, then click **Start Ollama**. After a successful install or start, a New chat opens so you can pick a model.

**No local models listed**  
Install one from the library search (`smollm2:135m`). If Ollama is on another machine, set the host in Settings (`http://127.0.0.1:11434` by default). After Ollama is running, a New chat is created for you — choose a model from the header, or from the list if none are installed yet.

**ChatGPT / Claude / Grok / Kimi / DeepSeek missing**  
Open **Studio → Cloud base** (or Settings). ChatGPT, Grok, and Kimi: click **Sign in**. If ChatGPT talks about enabling device-code in Security Settings, close that tab and use **Sign in** again — this app uses the normal ChatGPT login, not device-code. Claude and DeepSeek need an API key from their console. For a model on your own server or another cloud, fill **Remote APIs** (base URL, optional key, model name). The server must speak the OpenAI chat API.

**ChatGPT says insufficient quota**  
That is the paid OpenAI API, not your ChatGPT plan. Sign in with ChatGPT in Cloud base (do not paste a platform API key), then pick a ChatGPT GPT-5.4 or Codex model.

**Kimi says invalid temperature**  
Kimi Code only accepts temperature 1. The app now sends that automatically after you sign in with Kimi.

**GitHub authenticate failed**  
The token needs **repo** access. Fine-grained tokens must allow the target repository. This app does not use GitHub OAuth.

**n8n cannot reach the model**  
Use the connection card in **Studio → n8n**. For a Chat Model node, Provider is **Self-hosted**, Base URL ends in `/api/v1`, and the API key is the Fast API key — not n8n’s own key. For Ollama’s own node, leave the API key blank. If n8n is in Docker, do not use `127.0.0.1`; copy **Base URL if n8n is in Docker**. n8n Cloud cannot call a model that only exists on this computer unless this app is public.

**Review cycle does nothing**  
Pick a **tester** different from the model in the header, then click **Start review**. Works on a chat that already has messages.

**Signed-in ChatGPT / Grok / Kimi suddenly 401**  
The app refreshes the sign-in token before each send (ChatGPT uses the same form-encoded token URL as sign-in). If refresh is rejected, you are signed out of that account so an API key can be used instead.

**Edit a message and the file is gone**  
Editing a prompt now keeps the original images and files on the new version.

**Review uses too much memory**  
Grok + ChatGPT review no longer resends the whole thread and file bytes every cycle. Refresh if an old tab is still running a previous review. Image previews stay in the open chat; large document bytes are not kept after send.

**Replies feel much slower than the terminal**  
Tokens go straight from the model to the page. The app does not wait for the whole reply, does not re-parse markdown while text is still arriving, and does not rewrite the whole chat history on each token — so a large history should not slow the live output. Keep the model loaded (the app talks to Ollama like `ollama run`). If you open the app as `http://192.168.x.x:8080` on a phone (Termux), set `OLLAMA_ORIGINS=*` so the page can reach Ollama directly.

**The computer freezes when switching models**  
Ollama was keeping the old model in RAM while loading the new one. Switching now unloads every other local model first, then the next message loads only the one you picked. Wait a moment after switching before sending if the previous model was large.

**Back on the phone leaves the app**  
News, Studio, Settings, Review, the chat menu, and the language list each take one **Back** press. After those are closed, Back can leave the page.

**Grok says the CLI is outdated**  
That was a Grok sign-in bug, not something to run in a terminal. Ollama_UI now sends Grok the client version it expects. Sign out and Sign in again under Studio → Cloud base if an old session still shows it.

**Phi-3 (or another model) says it needs 50 GiB**  
Ollama_UI reads each model's own context window from the model (GGUF / Ollama) for the meter. Chat itself uses Ollama’s default loaded window, like the terminal. Phi-3’s published window is 128k even though the file is about 2 GB — that long window is what asks for tens of gigabytes of RAM. If a long chat actually needs more than the default and this computer cannot hold it, the reply retries with a shorter window that matches the RAM Ollama reported. Close other loaded models if it still fails.

**Node not found**  
Install Node.js 22+ from [nodejs.org](https://nodejs.org), then `make run`.

## License

Copyright (c) 2026 Elyass Shinwari.

Ollama_UI is free to use, copy, and modify under an MIT-style grant. See [LICENSE](LICENSE).

Commercial use is free up to 1,000,000 users. If a commercial product or service that includes this software has more than 1,000,000 users, you must ask Elyass Shinwari for extra permission.
