import assert from "node:assert/strict";
import test from "node:test";

const cloud = await import("../src/lib/llm/cloud.ts");
const files = await import("../src/lib/llm/files.ts");
const repeat = await import("../src/lib/llm/repeat.ts");
const tree = await import("../src/lib/chat/tree.ts");
const git = await import("../src/lib/studio/github.ts");

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
});

test("isChatGptOAuth distinguishes JWT sign-in from API keys", () => {
  assert.equal(cloud.isChatGptOAuth("sk-proj-abc"), false);
  assert.equal(cloud.isChatGptOAuth("aaa.bbb.ccc"), true);
  assert.equal(cloud.isChatGptOAuth(""), false);
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
  for (const task of pairs.PAIR_TASKS) {
    assert.notEqual(task.light.writer, task.light.tester);
    assert.notEqual(task.heavy.writer, task.heavy.tester);
    assert.ok(task.light.writer.length > 0);
    assert.ok(task.heavy.tester.length > 0);
  }
  const status = pairs.pairStatus(
    [
      { id: "qwen2.5-coder:1.5b", name: "qwen2.5-coder:1.5b", provider: "ollama", transport: "server" },
      { id: "codegemma:2b", name: "codegemma:2b", provider: "ollama", transport: "server" },
    ],
    coding.light,
  );
  assert.equal(status.ready, true);
  assert.equal(status.writer?.id, "qwen2.5-coder:1.5b");
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
});
