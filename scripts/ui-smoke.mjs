import { chromium } from "playwright";

const base = process.env.SMOKE_URL || "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

async function fail(msg) {
  console.error("FAIL", msg);
  await page.screenshot({ path: "/tmp/ui-smoke-fail.png" }).catch(() => {});
  await browser.close().catch(() => {});
  process.exit(1);
}

await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);
const home = await page.locator("body").innerText();
if (!/Ollama UI|Choose a model|Choose a local model|New chat/i.test(home)) {
  await fail("home did not render");
}

const studio = page.getByRole("button", { name: "Studio" }).first();
if (!(await studio.count())) await fail("Studio button missing");
await studio.click();
await page.waitForTimeout(400);
const studioText = await page.locator("body").innerText();
if (!/Cloud base/.test(studioText)) await fail("Studio is missing Cloud base");
if (/Back to new chat/i.test(studioText)) await fail("Back button still says Back to new chat");
const back = page.getByRole("button", { name: "Back to chat" }).first();
if (!(await back.count())) await fail("Back to chat missing");
await page.getByRole("button", { name: "Cloud base" }).first().click();
await page.waitForTimeout(400);
const cloud = await page.locator("body").innerText();
for (const name of ["ChatGPT", "Grok", "Kimi", "Claude", "DeepSeek"]) {
  if (!cloud.includes(name)) await fail(`Cloud base missing ${name}`);
}
if ((await page.getByRole("button", { name: /^Sign in$/ }).count()) < 3) {
  await fail("expected Sign in for ChatGPT, Grok, and Kimi");
}
await back.click();
await page.waitForTimeout(400);

const grok = page.getByRole("button", { name: "Grok 4.5" }).first();
if (await grok.count()) {
  await grok.click();
  await page.waitForTimeout(500);
} else {
  const anyModel = page.locator("header").getByRole("button").filter({ hasText: /Grok|GPT|Claude|Kimi|DeepSeek|smollm/i }).first();
  if (await anyModel.count()) await anyModel.click();
}

await page.waitForTimeout(400);
const after = await page.locator("body").innerText();
if (!/Start review/.test(after)) await fail("Start review missing after choosing a model");
if (!/Tester/.test(after)) await fail("Tester picker missing");
if (!/Cycles/.test(after)) await fail("Cycles control missing");

const prev = page.getByRole("button", { name: "Previous model" });
const next = page.getByRole("button", { name: "Next model" });
if (!(await prev.count()) || !(await next.count())) await fail("model previous/next missing");

const file = page.locator('input[type="file"]').first();
if (await file.count()) {
  const accept = await file.getAttribute("accept");
  if (accept) await fail(`file input should accept all types, got ${accept}`);
}

const named = page.getByRole("button", { name: /Delete New chat/i });
if (await named.count()) {
  await named.first().click();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await page.waitForTimeout(300);
} else if (!(await page.getByRole("button", { name: /Delete/i }).count())) {
  await fail("cannot delete chats from history");
}

if (errors.some((e) => !/favicon|ResizeObserver|hydration/i.test(e))) {
  await fail(`page errors: ${errors.slice(0, 5).join(" | ")}`);
}

console.log("UI smoke ok");
await browser.close();
