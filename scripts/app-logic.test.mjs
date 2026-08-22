import assert from "node:assert/strict";
import test from "node:test";

const cloud = await import("../src/lib/llm/cloud.ts");
const files = await import("../src/lib/llm/files.ts");
const repeat = await import("../src/lib/llm/repeat.ts");
const tree = await import("../src/lib/chat/tree.ts");

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
