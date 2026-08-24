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

function pass(msg) {
  console.log("PASS", msg);
}

await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(900);
const home = await page.locator("body").innerText();
if (!/Ollama UI|Choose a model|New chat/i.test(home)) await fail("home did not render");
pass("home");

const studio = page.getByRole("button", { name: "Studio" }).first();
if (!(await studio.count())) await fail("Studio missing");
await studio.click();
await page.waitForTimeout(400);
if (!/Cloud base/.test(await page.locator("body").innerText())) await fail("Cloud base tab missing");
if (/Back to new chat/i.test(await page.locator("body").innerText())) await fail("wrong back label");
if (!(await page.getByRole("button", { name: "Back to chat" }).count())) await fail("Back to chat missing");
pass("studio chrome");

const tabs = ["GitHub", "Cloud base", "MCP", "API", "Channels", "Instructions", "Train", "Advisor"];
for (const tab of tabs) {
  const btn = page.getByRole("button", { name: tab, exact: true }).first();
  if (!(await btn.count())) await fail(`Studio tab missing: ${tab}`);
  await btn.click();
  await page.waitForTimeout(200);
  const text = await page.locator("body").innerText();
  if (tab === "GitHub" && !/Authenticate GitHub|Pull repository/i.test(text)) await fail("GitHub tab empty");
  if (tab === "Cloud base") {
    for (const name of ["ChatGPT", "Grok", "Kimi", "Claude", "DeepSeek"]) {
      if (!text.includes(name)) await fail(`Cloud base missing ${name}`);
    }
    if ((await page.getByRole("button", { name: /^Sign in$/ }).count()) < 3) {
      await fail("Sign in missing for ChatGPT/Grok/Kimi");
    }
  }
  if (tab === "MCP" && !/MCP/i.test(text)) await fail("MCP tab empty");
  if (tab === "API" && !/API key|api/i.test(text)) await fail("API tab empty");
  if (tab === "Channels" && !/WhatsApp|webhook|channel/i.test(text)) await fail("Channels tab empty");
  if (tab === "Instructions" && !/instruction|knowledge/i.test(text)) await fail("Instructions tab empty");
  if (tab === "Train" && !/train|fine-tun|Unsloth|GGUF/i.test(text)) await fail("Train tab empty");
  if (tab === "Advisor" && !/advisor|model|pull/i.test(text)) await fail("Advisor tab empty");
  pass(`studio ${tab}`);
}

await page.getByRole("button", { name: "Back to chat" }).first().click();
await page.waitForTimeout(300);
pass("back to chat");

const settingsBtn = page.getByRole("button", { name: "Settings" }).first();
if (await settingsBtn.count()) {
  await settingsBtn.click();
  await page.waitForTimeout(300);
  const st = await page.locator("body").innerText();
  if (!/Ollama host|Temperature|Appearance|Cloud accounts/i.test(st)) await fail("Settings incomplete");
  for (const theme of ["Light", "Dark", "System"]) {
    if (!(await page.getByRole("button", { name: theme, exact: true }).count())) {
      await fail(`theme ${theme} missing`);
    }
  }
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(200);
  pass("settings");
}

const grok = page.getByRole("button", { name: /Grok 4\.5/ }).first();
if (await grok.count()) {
  await grok.click();
  await page.waitForTimeout(400);
  pass("chose Grok 4.5");
} else {
  const anyCloud = page.getByRole("button").filter({ hasText: /Grok|ChatGPT|Claude|Kimi|DeepSeek|GPT/ }).first();
  if (await anyCloud.count()) {
    await anyCloud.click();
    await page.waitForTimeout(400);
    pass("chose a cloud model");
  }
}

const after = await page.locator("body").innerText();
if (!/Start review/.test(after)) {
  await page.getByText("Grok 4.5", { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(400);
}
if (!/Start review/.test(await page.locator("body").innerText())) await fail("Start review missing");
if (!/Tester/.test(after)) await fail("Tester missing");
if (!/Cycles/.test(after)) await fail("Cycles missing");
pass("review bar");

if (!(await page.getByRole("button", { name: "Previous model" }).count())) await fail("previous model missing");
if (!(await page.getByRole("button", { name: "Next model" }).count())) await fail("next model missing");
pass("model cycle");

await page.getByRole("button", { name: "Next model" }).click();
await page.waitForTimeout(200);
pass("cycled model");

const file = page.locator('input[type="file"]').first();
if (await file.count()) {
  const accept = await file.getAttribute("accept");
  if (accept) await fail(`file input restricted: ${accept}`);
  pass("file input accepts all");
}

const newChat = page.getByRole("button", { name: "New chat" }).first();
if (await newChat.count()) {
  await newChat.click();
  await page.waitForTimeout(200);
  pass("new chat");
}

const del = page.getByRole("button", { name: /Delete New chat/i }).first();
if (await del.count()) {
  await del.click();
  await page.waitForTimeout(200);
  const confirm = page.getByRole("button", { name: "Delete", exact: true }).last();
  if (!(await confirm.count())) await fail("delete confirm missing");
  await confirm.click();
  await page.waitForTimeout(200);
  pass("delete chat");
} else {
  console.log("WARN no New chat trash (maybe already deleted)");
}

const themeToggle = page.getByRole("button", { name: /Dark mode|Light mode/ });
if (await themeToggle.count()) {
  await themeToggle.first().click();
  await page.waitForTimeout(200);
  pass("theme toggle");
}

if (errors.some((e) => !/favicon|ResizeObserver|hydration|Download the React DevTools/i.test(e))) {
  await fail(`page errors: ${errors.slice(0, 5).join(" | ")}`);
}

console.log("UI smoke ok");
await browser.close();
