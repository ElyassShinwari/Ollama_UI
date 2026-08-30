import assert from "node:assert/strict";
import test from "node:test";

const cloud = await import("../src/lib/llm/cloud.ts");
const files = await import("../src/lib/llm/files.ts");
const repeat = await import("../src/lib/llm/repeat.ts");
const tree = await import("../src/lib/chat/tree.ts");
const git = await import("../src/lib/studio/github.ts");
const speech = await import("../src/lib/speech.ts");
const i18n = await import("../src/lib/i18n.ts");
const utils = await import("../src/lib/utils.ts");

test("reviewSatisfied accepts a tester that is done", () => {
  assert.equal(cloud.reviewSatisfied("SATISFIED\nLooks good."), true);
  assert.equal(cloud.reviewSatisfied("APPROVED"), true);
  assert.equal(cloud.reviewSatisfied("The types are wrong."), false);
});

test("handoffs pass the latest answer, not an empty shell", () => {
  const toTester = cloud.handoffToTester("Grok", "function add(a,b){return a+b}", 2, 5);
  assert.match(toTester, /Grok/);
  assert.match(toTester, /function add/);
  const toWriter = cloud.handoffToWriter("ChatGPT", "Fix the name.");
  assert.match(toWriter, /ChatGPT/);
  assert.match(toWriter, /Fix the name/);
  const last = cloud.finalHandoff("Grok", "function add(){}");
  assert.match(last, /yourself/);
  assert.match(last, /function add/);
  assert.match(cloud.FINAL_REVIEW_SYSTEM, /yourself/i);
});

test("isChatGptOAuth distinguishes JWT sign-in from API keys", () => {
  assert.equal(cloud.isChatGptOAuth("sk-proj-abc"), false);
  assert.equal(cloud.isChatGptOAuth("aaa.bbb.ccc"), true);
  assert.equal(cloud.isChatGptOAuth(""), false);
});

test("Grok sign-in sends a CLI version so chat is not rejected as outdated", () => {
  const jwt = "aaa.bbb.ccc";
  assert.equal(cloud.isXaiOAuth("xai-key"), false);
  assert.equal(cloud.isXaiOAuth(jwt), true);
  const headers = cloud.extraCloudHeaders("xai", jwt);
  assert.equal(headers["x-grok-client-version"], cloud.XAI_CLI_VERSION);
  assert.match(cloud.XAI_CLI_VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(cloud.XAI_CLI_VERSION >= "0.1.202");
  assert.equal(Object.keys(cloud.extraCloudHeaders("xai", "xai-paid-key")).length, 0);
  assert.equal(
    cloud.isGrokCliVersionError(
      "Your Grok CLI version (none) is outdated. Please update to version 0.1.202 or later via grok update",
    ),
    true,
  );
});

test("ChatGPT OAuth catalog is not the paid GPT-4o list", () => {
  const ids = cloud.CHATGPT_OAUTH_MODELS.map((m) => m.id);
  assert.ok(ids.includes("gpt-5.4"));
  assert.ok(ids.includes("gpt-5.3-codex"));
  assert.ok(!ids.includes("gpt-4o"));
});

test("cloud labels stay product names", () => {
  assert.equal(cloud.CLOUD_LABEL.openai, "ChatGPT");
  assert.equal(cloud.CLOUD_LABEL.xai, "Grok");
  assert.equal(cloud.CLOUD_LABEL.anthropic, "Claude");
});

test("files: text is inlined, unknown types are still attached", async () => {
  const txt = await files.readDroppedFile(new File(["hello world"], "notes.txt", { type: "text/plain" }));
  assert.equal(txt.ok, true);
  if (txt.ok) {
    assert.equal(txt.file.kind, "txt");
    assert.equal(txt.file.text, "hello world");
  }
  const bin = await files.readDroppedFile(
    new File([new Uint8Array([0, 1, 2, 3, 0, 9, 10])], "blob.bin", { type: "application/octet-stream" }),
  );
  assert.equal(bin.ok, true);
  if (bin.ok) assert.equal(bin.file.kind, "file");
});

test("files: oversized files report a size reason, not a generic type block", async () => {
  const huge = new File([new Uint8Array(17 * 1024 * 1024)], "big.bin");
  const result = await files.readDroppedFile(huge);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /larger than/);
});

test("buildMessageFromFiles keeps text, images, and documents", () => {
  const built = files.buildMessageFromFiles("see this", [
    { id: "1", name: "a.txt", kind: "txt", ext: ".txt", text: "alpha" },
    {
      id: "2",
      name: "pic.png",
      kind: "image",
      ext: ".png",
      mime: "image/png",
      base64: "aaaa",
    },
    {
      id: "3",
      name: "doc.pdf",
      kind: "file",
      ext: ".pdf",
      mime: "application/pdf",
      base64: "bbbb",
    },
  ]);
  assert.match(built.content, /see this/);
  assert.match(built.content, /alpha/);
  assert.equal(built.images?.length, 1);
  assert.equal(built.documents?.length, 1);
  assert.equal(built.documents?.[0]?.name, "doc.pdf");
});

test("inferCaps: Grok and ChatGPT accept files and images", () => {
  const grok = files.inferCaps({ id: "grok-4.5", provider: "xai" });
  assert.equal(grok.vision, true);
  assert.equal(grok.openFiles, true);
  const gpt = files.inferCaps({ id: "gpt-5.4", provider: "openai" });
  assert.equal(gpt.vision, true);
});

test("repetitionCutoff stops a stuck loop", () => {
  const loop = "abcdefghijklmnop".repeat(4);
  assert.notEqual(repeat.repetitionCutoff(loop), null);
  assert.equal(repeat.repetitionCutoff("A unique sentence."), null);
});

test("conversation tree follows selected children", () => {
  const messages = [
    { id: "u1", role: "user", content: "hi", createdAt: 1, parentId: null, selectedChildId: "a1" },
    { id: "a1", role: "assistant", content: "one", createdAt: 2, parentId: "u1", selectedChildId: null },
    { id: "a2", role: "assistant", content: "two", createdAt: 3, parentId: "u1", selectedChildId: null },
  ];
  const visible = tree.visibleMessages(messages, "u1");
  assert.equal(visible.map((m) => m.id).join(","), "u1,a1");
  const switched = messages.map((m) => (m.id === "u1" ? { ...m, selectedChildId: "a2" } : m));
  assert.equal(tree.visibleMessages(switched, "u1").at(-1)?.content, "two");
});

test("review cycle markers are notes and stay out of chat turns", () => {
  assert.equal(
    tree.isNoteMessage({ role: "note", content: "Cycle 1/3 · llama testing" }),
    true,
  );
  assert.equal(
    tree.isNoteMessage({ role: "user", content: "Cycle 2/5 · qwen revising" }),
    true,
  );
  assert.equal(
    tree.isNoteMessage({ role: "user", content: "Finished by qwen2.5" }),
    true,
  );
  assert.equal(tree.isNoteMessage({ role: "user", content: "Please review this" }), false);
  const path = [
    { id: "u1", role: "user", content: "write code", createdAt: 1, parentId: null, selectedChildId: "a1" },
    { id: "a1", role: "assistant", content: "fn()", createdAt: 2, parentId: "u1", selectedChildId: "n1" },
    { id: "n1", role: "note", content: "Cycle 1/2 · tester testing", createdAt: 3, parentId: "a1", selectedChildId: "a2" },
    { id: "a2", role: "assistant", content: "looks ok", createdAt: 4, parentId: "n1", selectedChildId: null },
  ];
  const visible = tree.visibleMessages(path, "u1");
  assert.equal(visible.length, 4);
  const turns = tree.chatTurnsOf(visible);
  assert.deepEqual(
    turns.map((m) => m.role),
    ["user", "assistant", "assistant"],
  );
});

test("sanitizeOllamaHost accepts http hosts and rejects others", () => {
  assert.equal(utils.sanitizeOllamaHost("http://127.0.0.1:11434/"), "http://127.0.0.1:11434");
  assert.equal(utils.sanitizeOllamaHost("https://ollama.example"), "https://ollama.example");
  assert.throws(() => utils.sanitizeOllamaHost("file:///etc/passwd"));
  assert.throws(() => utils.sanitizeOllamaHost("javascript:alert(1)"));
  assert.throws(() => utils.sanitizeOllamaHost("not a url"));
});

test("responses API uses output_text on assistant turns", () => {
  assert.equal(cloud.responsesTextType("assistant"), "output_text");
  assert.equal(cloud.responsesTextType("user"), "input_text");
  assert.equal(cloud.responsesTextType("system"), "input_text");
});

test("GitHub clone URLs accept trailing slashes and .git", () => {
  assert.deepEqual(git.parseRepoUrl("https://github.com/owner/repo/"), {
    owner: "owner",
    repo: "repo",
    slug: "owner-repo",
  });
  assert.deepEqual(git.parseRepoUrl("https://github.com/owner/repo.git/"), {
    owner: "owner",
    repo: "repo",
    slug: "owner-repo",
  });
  assert.deepEqual(git.parseRepoUrl("owner/repo.git"), {
    owner: "owner",
    repo: "repo",
    slug: "owner-repo",
  });
  assert.deepEqual(git.parseRepoUrl("https://github.com/owner/repo/tree/main"), {
    owner: "owner",
    repo: "repo",
    slug: "owner-repo",
  });
});

test("sameOllamaId treats :latest as the untagged name", async () => {
  const library = await import("../src/lib/llm/library.ts");
  assert.equal(library.sameOllamaId("moondream:latest", "moondream"), true);
  assert.equal(library.sameOllamaId("llama3.2:1b", "llama3"), false);
});

test("switching models unloads every loaded runner except the new one", async () => {
  const ollama = await import("../src/lib/llm/ollama-client.ts");
  assert.deepEqual(
    ollama.loadedOllamaNames({
      models: [{ name: "llama3.2:latest" }, { model: "smollm2:135m" }, {}],
    }),
    ["llama3.2:latest", "smollm2:135m"],
  );
  assert.deepEqual(ollama.modelsToUnload(["llama3.2:latest", "smollm2:135m"], "smollm2:135m"), [
    "llama3.2:latest",
  ]);
  assert.deepEqual(ollama.modelsToUnload(["phi3:latest"], "phi3"), []);
  assert.deepEqual(ollama.modelsToUnload(["llama3.2"], undefined), ["llama3.2"]);
});

test("library search suggests queries and lists all matching models", async () => {
  const library = await import("../src/lib/llm/library.ts");
  const suggested = library.suggestQueries("qw");
  assert.equal(suggested[0], "qwen");
  assert.ok(suggested.includes("qwen2.5"));
  assert.ok(suggested.includes("qwen3"));
  assert.ok(library.suggestQueries("llama").includes("llama3.2"));

  const html = `
    <a href="/library/qwen2.5"><h2>qwen2.5</h2><p>Qwen2.5 models.</p>
      <span>0.5b</span><span>1.5b</span><span>14b</span><span>tools</span></a>
    <a href="/library/qwen2.5-coder"><h2>qwen2.5-coder</h2><p>Coder.</p>
      <span>0.5b</span><span>7b</span></a>`;
  const parsed = library.parseLibraryHtml(html);
  const qwen = parsed.find((m) => m.name === "qwen2.5");
  const coder = parsed.find((m) => m.name === "qwen2.5-coder");
  assert.ok(qwen);
  assert.deepEqual(qwen.tags, ["0.5b", "1.5b", "14b"]);
  assert.ok(coder);
  assert.ok(coder.tags.includes("7b"));
  assert.ok(!qwen.tags.includes("tools"));
  const noisy = library.parseLibraryHtml(
    `<a href="/library/phi3"><span>mini</span><span>3.8b</span><span>18.1m</span><span>766.8k</span></a>`,
  );
  assert.deepEqual(noisy[0].tags, ["mini", "3.8b"]);

  const filtered = library.filterLibrary(parsed, "qwen");
  assert.equal(filtered.length, 2);

  const hf = library.parseHfModels([
    { id: "unsloth/Qwen2.5-7B-Instruct-GGUF", downloads: 12500, pipeline_tag: "text-generation" },
  ]);
  assert.equal(hf[0].source, "huggingface");
  assert.equal(hf[0].pullId, "hf.co/unsloth/Qwen2.5-7B-Instruct-GGUF");
  assert.deepEqual(library.pullIdsFor(hf[0]), ["hf.co/unsloth/Qwen2.5-7B-Instruct-GGUF"]);
  assert.equal(
    library.stripQuantSuffix("hf.co/unsloth/Qwen2.5-7B-Instruct-GGUF:Q4_K_M"),
    "hf.co/unsloth/Qwen2.5-7B-Instruct-GGUF",
  );

  const fromUrl = library.parseModelUrl(
    "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
  );
  assert.equal(fromUrl.repo, "bartowski/Llama-3.2-1B-Instruct-GGUF");
  assert.equal(fromUrl.pullId, "hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M");
  assert.equal(library.quantFromFilename("Qwen3-Instruct-Q5_K_M.gguf"), "Q5_K_M");
  const quants = library.quantsFromSiblings([
    { rfilename: "model-Q4_K_M.gguf" },
    { rfilename: "BF16/model-BF16-00001-of-00002.gguf" },
  ]);
  assert.deepEqual(quants, ["Q4_K_M"]);

  const ollamaUrl = library.parseModelUrl("https://ollama.com/library/qwen2.5:1.5b");
  assert.equal(ollamaUrl.name, "qwen2.5");
  assert.deepEqual(ollamaUrl.tags, ["1.5b"]);
});


test("parseRss extracts title, link, image, and youtube thumbs", async () => {
  const news = await import("../src/lib/news/feeds.ts");
  assert.equal(news.decodeXml("A &" + "amp; B &" + "lt;ok&" + "gt;"), "A & B <ok>");
  assert.equal(news.decodeXml("hi &" + "amp;nbsp; there"), "hi   there");
  const rss = `
    <rss><channel>
      <item>
        <title><![CDATA[Ollama 1.0]]></title>
        <link>https://ollama.com/blog/one</link>
        <pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate>
        <source>Ollama</source>
        <description><![CDATA[<p>Local models.</p><img src="https://ollama.com/one.png" />]]></description>
      </item>
      <item>
        <title>Skip me</title>
        <guid>not-a-url</guid>
      </item>
    </channel></rss>`;
  const items = news.parseRss(rss);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Ollama 1.0");
  assert.equal(items[0].link, "https://ollama.com/blog/one");
  assert.equal(items[0].image, "https://ollama.com/one.png");
  assert.equal(items[0].source, "Ollama");

  const atom = `
    <feed>
      <entry>
        <title>AI video</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
        <yt:videoId>abcdefghijk</yt:videoId>
        <media:content url="https://www.youtube.com/v/abcdefghijk?version=3" type="application/x-shockwave-flash"/>
        <published>2025-02-01T00:00:00Z</published>
      </entry>
    </feed>`;
  const videos = news.parseRss(atom, "YouTube");
  assert.equal(videos.length, 1);
  assert.equal(videos[0].video, true);
  assert.match(videos[0].image || "", /ytimg/);
  assert.doesNotMatch(videos[0].image || "", /youtube\.com\/v\//);

  const merged = news.mergeNews([items, videos, items], "pictures");
  assert.equal(merged.length, 2);
  assert.ok(merged.every((item) => item.image));

  const videoOnly = news.mergeNews([items, videos], "videos");
  assert.equal(videoOnly.length, 1);
  assert.equal(videoOnly[0].video, true);

  const nested = news.parseRss(`
    <feed>
      <entry>
        <title>Release</title>
        <link href="https://github.com/ollama/ollama/releases/tag/v1"/>
        <author><name>github-actions[bot]</name><uri>https://github.com/apps/github-actions</uri></author>
      </entry>
    </feed>`);
  assert.equal(nested[0].source, "github-actions[bot]");
});

test("each model keeps its own context window, not a size-based guess", async () => {
  const ctx = await import("../src/lib/llm/context.ts");
  const twoGb = 2.2 * 1024 ** 3;
  const oneGb = 1.1 * 1024 ** 3;

  assert.equal(
    ctx.parseOllamaContextLength(
      { model_info: { "phi3.context_length": 131072 }, parameters: "num_ctx 4096" },
      { modelId: "phi3:3.8b", sizeBytes: twoGb },
    ),
    131072,
  );
  assert.equal(
    ctx.parseOllamaContextLength(
      { model_info: { "gemma2.context_length": 8192 } },
      { modelId: "gemma2:2b", sizeBytes: oneGb },
    ),
    8192,
  );
  assert.equal(
    ctx.parseOllamaContextLength(
      { model_info: { "qwen2.context_length": 32768 } },
      { modelId: "qwen2.5:1.5b", sizeBytes: oneGb },
    ),
    32768,
  );
  assert.equal(
    ctx.parseOllamaContextLength(
      { model_info: { "llama.context_length": 131072 } },
      { modelId: "llama3.2:3b", sizeBytes: twoGb },
    ),
    131072,
  );
  assert.equal(
    ctx.parseOllamaContextLength({}, { modelId: "phi3:mini" }),
    131072,
  );
  assert.equal(ctx.lookupPublishedContext("gemma2:2b"), 8192);
  assert.equal(ctx.lookupPublishedContext("qwen2.5:1.5b"), 32768);
  assert.equal(ctx.lookupPublishedContext("llama3.2:1b"), 131072);
  assert.equal(ctx.lookupPublishedContext("Phi-3-mini-4k-instruct"), 4096);
  assert.equal(ctx.lookupPublishedContext("totally-unknown-model"), undefined);
  assert.equal(
    ctx.parseOllamaContextLength({}, { parameterSize: "3.8B" }),
    8192,
  );

  const oom = '{"error":"model requires more system memory (50.6 GiB) than is available (11.7 GiB)"}';
  assert.equal(ctx.isOllamaMemoryError(oom), true);
  const scaled = ctx.nextCtxForMemoryError(131072, oom);
  assert.ok(scaled && scaled < 131072 && scaled >= 2048);
  assert.match(ctx.friendlyOllamaError(oom), /real window/i);
  assert.doesNotMatch(ctx.friendlyOllamaError(oom), /50\.6/);
  assert.doesNotMatch(
    ctx.friendlyOllamaError(
      "Your Grok CLI version (none) is outdated. Please update to version 0.1.202 or later via grok update",
    ),
    /grok update/i,
  );
  assert.equal(ctx.initialOllamaNumCtx(), undefined);
  assert.equal(ctx.ollamaChatOptions(0.7), undefined);
  assert.deepEqual(ctx.ollamaChatOptions(0.7, 4096), { num_ctx: 4096 });
  assert.equal(ctx.nextCtxForOverflow(undefined, 131072), 4096);
  assert.equal(ctx.nextCtxForOverflow(4096, 131072), 8192);
  assert.equal(ctx.nextCtxForOverflow(131072, 131072), undefined);
  assert.equal(ctx.isOllamaBusyError('{"error":"server busy, please try again."}'), true);
  assert.equal(ctx.isOllamaBusyError("model is currently loading"), true);
  assert.equal(ctx.isOllamaBusyError("the types are wrong"), false);
});

test("pullProgress maps Ollama completed/total to a percent", async () => {
  const setup = await import("../src/lib/llm/setup.ts");
  assert.equal(setup.pullProgress({ completed: 50, total: 100 }), 50);
  assert.equal(setup.pullProgress({ completed: 100, total: 100 }), 100);
  assert.equal(setup.pullProgress({ completed: 0, total: 200 }), 0);
  assert.equal(setup.pullProgress({ completed: 3, total: 0 }), null);
  assert.equal(setup.pullProgress({}), null);
});

test("review pairs keep writer and tester different, with a coding pair", async () => {
  const pairs = await import("../src/lib/llm/pairs.ts");
  const coding = pairs.PAIR_TASKS.find((t) => t.id === "coding");
  assert.ok(coding);
  assert.match(coding.blurb, /coder/i);
  assert.equal(pairs.PAIR_LANES.length, 4);
  for (const task of pairs.PAIR_TASKS) {
    const lanes = pairs.pairLanes(task);
    assert.equal(lanes.length, 4);
    assert.deepEqual(
      lanes.map((l) => l.label),
      ["Very light", "Light", "Medium", "Heavy"],
    );
    for (const lane of lanes) {
      assert.notEqual(lane.pair.writer, lane.pair.tester);
      assert.ok(lane.pair.writer.length > 0);
      assert.ok(lane.pair.tester.length > 0);
    }
  }
  const same = pairs.pairStatus(
    [{ id: "smollm2:135m", name: "smollm2:135m", provider: "ollama", transport: "server" }],
    { writer: "smollm2:135m", tester: "smollm2:135m", ram: "same" },
  );
  assert.equal(same.ready, true);
  assert.equal(same.writer?.id, same.tester?.id);
  assert.ok(cloud.REVIEW_SELF_SYSTEM.length > 20);
  const status = pairs.pairStatus(
    [
      { id: "qwen2.5-coder:0.5b", name: "qwen2.5-coder:0.5b", provider: "ollama", transport: "server" },
      { id: "deepseek-coder:1.3b", name: "deepseek-coder:1.3b", provider: "ollama", transport: "server" },
    ],
    coding.veryLight,
  );
  assert.equal(status.ready, true);
  assert.equal(status.writer?.id, "qwen2.5-coder:0.5b");
  assert.equal(
    pairs.findLocalModel(
      [{ id: "phi3:latest", name: "phi3", provider: "ollama", transport: "server" }],
      "phi3:mini",
    ),
    undefined,
  );
  assert.ok(pairs.findLocalModel(
    [{ id: "phi3:mini", name: "phi3:mini", provider: "ollama", transport: "server" }],
    "phi3:mini",
  ));
});

test("ollama chat payload matches the terminal: stream, no extra options", async () => {
  const ollama = await import("../src/lib/llm/ollama-client.ts");
  const body = ollama.ollamaChatPayload("smollm2:135m", [{ role: "user", content: "hi" }]);
  assert.equal(body.model, "smollm2:135m");
  assert.equal(body.stream, true);
  assert.equal(body.options, undefined);
  const withCtx = ollama.ollamaChatPayload(
    "smollm2:135m",
    [{ role: "user", content: "hi" }],
    { num_ctx: 4096 },
  );
  assert.equal(withCtx.options?.num_ctx, 4096);
  const parsed = ollama.parseOllamaNdjsonLine('{"message":{"role":"assistant","content":"Hello"}}');
  assert.equal(parsed?.content, "Hello");
  const chunks = [];
  const parser = ollama.createNdjsonParser((event) => {
    if (event.content) chunks.push(event.content);
  });
  parser.push('{"message":{"content":"Hel"}}\n{"message":{"content":"lo"}}\n');
  parser.end();
  assert.deepEqual(chunks, ["Hel", "lo"]);
  assert.equal(typeof ollama.streamOllamaDirect, "function");
  assert.equal(typeof ollama.streamOllamaFetch, "function");
});

test("voice draft joins spoken words onto existing text", () => {
  assert.equal(speech.joinDraft("", "hello there"), "hello there");
  assert.equal(speech.joinDraft("Write a function", "in rust"), "Write a function in rust");
  assert.equal(speech.joinDraft("  keep  ", ""), "keep");
  const ev = {
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: "hello" } }, { isFinal: false, 0: { transcript: "world" } }],
  };
  assert.equal(speech.transcriptFromSpeechEvent(ev), "hello world");
  assert.equal(speech.speechInputAvailable(), false);
});

test("voice input keeps one copy when the recognizer repeats a phrase", () => {
  const repeated = "install the model install the model install the model install the model";
  assert.equal(speech.collapseRepeatedSpeech(repeated), "install the model");
  assert.equal(speech.collapseRepeatedSpeech("hello hello hello hello"), "hello");
  assert.equal(speech.mergeSpoken("hello", "hello world"), "hello world");
  assert.equal(speech.mergeSpoken("hello world", "hello world"), "hello world");
  assert.equal(speech.mergeSpoken("hello world", "hello world hello world"), "hello world");
  assert.equal(speech.mergeSpoken("install the", "the model"), "install the model");
  assert.equal(speech.isDuplicateUtterance("hello there", "hello there"), true);
  assert.equal(speech.isDuplicateUtterance("hello there", "hello there friend"), false);
  const draft = speech.createSpeechDraft("");
  const first = {
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: "open a new chat" } }],
  };
  assert.equal(draft.apply(first), "open a new chat");
  const again = {
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: "open a new chat" } },
      { isFinal: true, 0: { transcript: "open a new chat" } },
      { isFinal: true, 0: { transcript: "open a new chat" } },
      { isFinal: true, 0: { transcript: "open a new chat" } },
    ],
  };
  assert.equal(draft.apply(again), "open a new chat");
  const growing = {
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: "open" } },
      { isFinal: true, 0: { transcript: "open a new chat" } },
    ],
  };
  assert.equal(draft.apply(growing), "open a new chat");
});

test("abort errors from a cancelled pull are recognized", async () => {
  const setup = await import("../src/lib/llm/setup.ts");
  assert.equal(setup.isAbortError(new DOMException("Aborted", "AbortError")), true);
  assert.equal(setup.isAbortError(new Error("The user aborted a request.")), true);
  assert.equal(setup.isAbortError(new Error("disk full")), false);
});

test("locales cover the requested languages including Dari and Pashto", () => {
  assert.equal(i18n.matchLocale("nl-NL"), "nl");
  assert.equal(i18n.matchLocale("de"), "de");
  assert.equal(i18n.matchLocale("fa-IR"), "fa");
  assert.equal(i18n.matchLocale("fa-AF"), "prs");
  assert.equal(i18n.matchLocale("ps-AF"), "ps");
  assert.equal(i18n.matchLocale("zh-CN"), "zh");
  assert.equal(i18n.matchLocale("ja-JP"), "ja");
  assert.equal(i18n.matchLocale("hi-IN"), "hi");
  assert.equal(i18n.matchLocale("pt-BR"), "pt");
  assert.equal(i18n.matchLocale("ar-SA"), "ar");
  assert.equal(i18n.t("de", "newChat"), "Neuer Chat");
  assert.equal(i18n.t("ja", "newChat"), "新しいチャット");
  assert.equal(i18n.t("hi", "language"), "भाषा");
  assert.equal(i18n.t("pt", "settings"), "Configurações");
  assert.equal(i18n.t("ps", "settings"), "تنظیمات");
  assert.equal(i18n.t("prs", "newChat"), "گفتگوی جدید");
  assert.equal(i18n.localeInfo("ar").dir, "rtl");
  assert.equal(i18n.localeInfo("nl").speech, "nl-NL");
  assert.equal(i18n.localeInfo("nl").flag, "🇳🇱");
  assert.equal(i18n.localeInfo("de").flag, "🇩🇪");
  assert.equal(i18n.localeInfo("fa").flag, "🇮🇷");
  assert.equal(i18n.localeInfo("prs").flag, "🇦🇫");
  assert.equal(i18n.localeInfo("ps").flag, "🇦🇫");
  assert.equal(i18n.localeInfo("zh").flag, "🇨🇳");
  assert.equal(i18n.localeInfo("ja").flag, "🇯🇵");
  assert.equal(i18n.localeInfo("hi").flag, "🇮🇳");
  assert.equal(i18n.localeInfo("pt").flag, "🇧🇷");
  assert.equal(i18n.localeInfo("ar").flag, "🇸🇦");
  assert.equal(i18n.localeInfo("ru").flag, "🇷🇺");
  assert.ok(i18n.LOCALES.every((item) => item.flag));
  assert.equal(i18n.t("en", "deleteChatBody", { title: "Hello" }).includes("Hello"), true);
  assert.equal(i18n.t("en", "lookThere"), "Look there");
  assert.equal(i18n.t("en", "remoteGroup"), "Remote");
  assert.equal(i18n.t("en", "onThisComputer"), "On this computer");
  assert.equal(i18n.t("ja", "lookThere"), "Look there");
  assert.equal(i18n.t("hi", "useModel"), "Use");
  assert.equal(i18n.t("pt", "remoteGroup"), "Remote");
});

test("first visit picks a local model or a choose-a-model placeholder", async () => {
  const starter = await import("../src/lib/chat/starter.ts");
  assert.equal(starter.isPlaceholderModel(null), true);
  assert.equal(starter.isPlaceholderModel({ id: "pending", name: "Choose a model", provider: "ollama", transport: "server" }), true);
  assert.equal(
    starter.isPlaceholderModel({ id: "smollm2:135m", name: "smollm2:135m", provider: "ollama", transport: "server" }),
    false,
  );
  assert.equal(starter.pickStarterModel([]), null);
  const llama = { id: "llama3.2:1b", name: "llama3.2:1b", provider: "ollama", transport: "server" };
  const gpt = { id: "gpt-5.4", name: "GPT-5.4", provider: "openai", transport: "server" };
  assert.equal(starter.pickStarterModel([gpt, llama])?.id, "llama3.2:1b");
  assert.equal(starter.pickStarterModel([gpt])?.id, "gpt-5.4");
});

test("/api/chat and other host routes sanitize Ollama hosts", async () => {
  const fs = await import("node:fs");
  const routes = [
    "chat.ts",
    "pull.ts",
    "delete-model.ts",
    "models.ts",
    "reset.ts",
    "setup.ts",
    "tokenize.ts",
    "v1.chat.completions.ts",
    "channel.ts",
  ];
  for (const name of routes) {
    const src = fs.readFileSync(new URL(`../src/routes/api/${name}`, import.meta.url), "utf8");
    assert.match(src, /sanitizeOllamaHost/, `${name} must sanitize host`);
  }
  const chat = fs.readFileSync(new URL("../src/routes/api/chat.ts", import.meta.url), "utf8");
  assert.match(chat, /status:\s*400/);
});

test("chat export keeps user text and omits secrets", async () => {
  const chatExport = await import("../src/lib/chat/export.ts");
  const conv = {
    id: "c1",
    title: "Hello",
    createdAt: 1,
    updatedAt: 2,
    pinned: false,
    model: { id: "llama", name: "Llama", provider: "ollama", transport: "server" },
    messages: [
      { id: "u", role: "user", content: "the secret plan", createdAt: 1, parentId: null },
      { id: "n", role: "note", content: "Cycle 1/2 · tester testing", createdAt: 2, parentId: "u" },
      { id: "a", role: "assistant", content: "ok", createdAt: 3, parentId: "n", modelName: "Llama" },
    ],
  };
  const backup = chatExport.conversationsBackup([conv]);
  const json = JSON.stringify(backup);
  assert.match(json, /the secret plan/);
  assert.match(json, /Cycle 1\/2/);
  assert.equal(json.includes("openaiKey"), false);
  assert.equal(json.includes("accessToken"), false);
  assert.equal("settings" in backup, false);
  const md = chatExport.conversationMarkdown(conv);
  assert.match(md, /the secret plan/);
  assert.match(md, /Cycle 1\/2/);
  assert.match(md, /^# Hello/m);
});

test("new i18n keys resolve in English and inherit in other locales", () => {
  assert.match(i18n.t("en", "streamOtherChat"), /streaming/);
  assert.match(i18n.t("en", "replyReady"), /Reply ready/);
  assert.equal(i18n.t("nl", "streamOtherChat"), i18n.t("en", "streamOtherChat"));
  assert.equal(i18n.t("ar", "jumpToLatest"), i18n.t("en", "jumpToLatest"));
  assert.equal(i18n.localeInfo("fa").dir, "rtl");
});

const n8n = await import("../src/lib/studio/n8n.ts");

test("n8n addresses: local default, cloud short name, pasted UI URLs", () => {
  assert.equal(n8n.defaultN8nBase("local"), "http://127.0.0.1:5678");
  assert.equal(n8n.defaultN8nBase("server"), "https://n8n.example.com");
  assert.equal(n8n.normalizeN8nBase("acme", "cloud"), "https://acme.app.n8n.cloud");
  assert.equal(
    n8n.sanitizeN8nBase("https://acme.app.n8n.cloud/home/workflows"),
    "https://acme.app.n8n.cloud",
  );
  assert.equal(
    n8n.sanitizeN8nBase("https://n8n.company.com/workflow/abc"),
    "https://n8n.company.com",
  );
  assert.equal(n8n.looksLikePlaceholder("https://your-instance.app.n8n.cloud"), true);
  assert.equal(n8n.looksLikePlaceholder("https://n8n.example.com"), true);
  assert.equal(n8n.looksLikePlaceholder("https://acme.app.n8n.cloud"), false);
  assert.equal(n8n.n8nKindFromBase("http://127.0.0.1:5678"), "local");
  assert.equal(n8n.n8nKindFromBase("https://acme.app.n8n.cloud"), "cloud");
  assert.equal(n8n.n8nKindFromBase("https://n8n.company.com"), "server");
  assert.equal(n8n.cloudInstanceName("https://acme.app.n8n.cloud"), "acme");
  assert.equal(n8n.normalizeN8nBase("n8n.company.com", "server"), "https://n8n.company.com");
  assert.ok(n8n.LOCAL_N8N_CANDIDATES.includes("http://127.0.0.1:5678"));
  assert.throws(() => n8n.normalizeN8nBase("acme", "server"));
});

test("n8n starter workflows talk to this app and expose a receive webhook", () => {
  const ask = n8n.askModelWorkflow({
    origin: "http://127.0.0.1:8080",
    secret: "secret-key",
    apiKey: "fast-api-key",
    model: "smollm2:135m",
  });
  assert.equal(ask.name, n8n.ASK_WORKFLOW_NAME);
  const http = ask.nodes.find((node) => node.type === "n8n-nodes-base.httpRequest");
  assert.ok(http);
  assert.equal(http.parameters.url, "http://127.0.0.1:8080/api/n8n");
  assert.equal(http.retryOnFail, true);
  assert.ok((http.maxTries ?? 0) >= 5);
  const headerBlock = http.parameters.headerParameters;
  const headerList =
    headerBlock && typeof headerBlock === "object" && "parameters" in headerBlock
      ? headerBlock.parameters
      : [];
  assert.ok(Array.isArray(headerList));
  assert.equal(
    headerList.find((h) => h && h.name === "x-n8n-secret")?.value,
    "secret-key",
  );
  assert.equal(
    headerList.find((h) => h && h.name === "Authorization")?.value,
    "Bearer fast-api-key",
  );
  const receive = n8n.receiveChatWorkflow();
  assert.equal(receive.name, n8n.RECEIVE_WORKFLOW_NAME);
  assert.equal(n8n.webhookPathFromNodes(receive.nodes), n8n.RECEIVE_WEBHOOK_PATH);
  assert.equal(
    n8n.n8nWebhookUrl("http://127.0.0.1:5678", n8n.RECEIVE_WEBHOOK_PATH),
    "http://127.0.0.1:5678/webhook/ollama-ui-chat",
  );
});

test("n8n inbound extracts chat text and clips outbound payloads", () => {
  assert.equal(n8n.extractN8nMessage({ message: "Hello" }), "Hello");
  assert.equal(n8n.extractN8nMessage({ body: { chatInput: "From n8n chat" } }), "From n8n chat");
  assert.equal(n8n.extractN8nModel({ model: "llama3.2" }, "fallback"), "llama3.2");
  const body = n8n.n8nOutboundBody({
    event: "assistant",
    user: "q",
    assistant: "a".repeat(25_000),
    model: "x",
    conversationId: "c1",
  });
  assert.equal(typeof body.assistant, "string");
  assert.ok(String(body.assistant).length < 25_000);
  assert.match(String(body.assistant), /…$/);
});

const lane = await import("../src/lib/studio/lane.server.ts");

test("n8n lane yields to chat and only runs one n8n job", () => {
  lane.resetLaneForTests();
  assert.equal(lane.chatIsBusy(), false);
  const first = lane.enterN8n();
  assert.equal(first.ok, true);
  const second = lane.enterN8n();
  assert.equal(second.ok, false);
  lane.leaveN8n();
  lane.setChatBusy(true);
  assert.equal(lane.chatIsBusy(), true);
  const blocked = lane.enterN8n();
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryMs >= 1000);
  lane.setChatBusy(false);
  const after = lane.enterN8n();
  assert.equal(after.ok, true);
  if (after.ok) after.signal.addEventListener("abort", () => {});
  lane.setChatBusy(true);
  assert.equal(after.ok && after.signal.aborted, true);
  lane.resetLaneForTests();
});

test("n8n HTTP example uses a Bearer API key", () => {
  const sample = n8n.n8nHttpExample("http://app", "sec", "llama3.2", "fast-key");
  assert.match(sample, /Authorization: Bearer fast-key/);
});

test("n8n connection output matches Self-hosted and Ollama credential fields", () => {
  const self = n8n.n8nSelfHostedConnection({
    origin: "http://127.0.0.1:8080",
    apiKey: "fast-key",
    model: "smollm2:135m",
  });
  assert.equal(self.provider, "Self-hosted");
  assert.equal(self.baseUrl, "http://127.0.0.1:8080/api/v1");
  assert.equal(self.apiKey, "fast-key");
  assert.equal(self.model, "smollm2:135m");
  const card = n8n.n8nConnectionText(self);
  assert.match(card, /Provider: Self-hosted/);
  assert.match(card, /Base URL: http:\/\/127.0.0.1:8080\/api\/v1/);
  assert.match(card, /API key: fast-key/);
  assert.match(card, /Model: smollm2:135m/);
  const ollama = n8n.n8nOllamaConnection({
    ollamaHost: "http://127.0.0.1:11434",
    model: "llama3.2",
  });
  assert.equal(ollama.provider, "Ollama");
  assert.equal(ollama.apiKey, "");
  assert.match(n8n.n8nConnectionText(ollama), /API key: \(leave blank\)/);
  assert.equal(
    n8n.n8nReachableFromDocker("http://127.0.0.1:8080/api/v1"),
    "http://host.docker.internal:8080/api/v1",
  );
});

test("remote OpenAI-compatible bases get /v1 and list models", async () => {
  const custom = await import("../src/lib/llm/custom.ts");
  assert.equal(custom.sanitizeCompatBase("127.0.0.1:8000"), "http://127.0.0.1:8000/v1");
  assert.equal(custom.sanitizeCompatBase("https://api.together.xyz/v1/"), "https://api.together.xyz/v1");
  assert.equal(
    custom.sanitizeCompatBase("https://openrouter.ai/api/v1/chat/completions"),
    "https://openrouter.ai/api/v1",
  );
  assert.equal(custom.compatChatUrl("http://gpu:8000"), "http://gpu:8000/v1/chat/completions");
  assert.deepEqual(custom.parseModelList("llama-3, mistral"), ["llama-3", "mistral"]);
  assert.equal(custom.isCompatChatModel("text-embedding-3-small"), false);
  assert.equal(custom.isCompatChatModel("llama-3.1-8b-instruct"), true);
  const endpoint = {
    id: "abc",
    name: "Work GPU",
    baseUrl: "http://127.0.0.1:8000/v1",
    apiKey: "",
    models: ["llama-3.1-8b-instruct"],
  };
  const refs = custom.modelsFromCustomEndpoints([endpoint]);
  assert.equal(refs[0]?.provider, "custom");
  assert.equal(refs[0]?.id, "abc:llama-3.1-8b-instruct");
  assert.match(refs[0]?.name ?? "", /Work GPU/);
  assert.equal(custom.remoteIdFromCustom(refs[0].id, "abc"), "llama-3.1-8b-instruct");
  assert.deepEqual(custom.parseCompatModelIds({ data: [{ id: "a" }, { name: "b" }] }), ["a", "b"]);
});
