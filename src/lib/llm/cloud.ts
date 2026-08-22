import type { ModelRef, Provider, Settings } from "@/lib/chat/types";

export type CloudId = Exclude<Provider, "ollama">;

export const CLOUD_LABEL: Record<CloudId, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  xai: "Grok",
  kimi: "Kimi",
  deepseek: "DeepSeek",
};

export const CLOUD_ACCOUNTS: {
  id: CloudId;
  label: string;
  login: string;
  keys: string;
  setting: keyof Settings;
  header: string;
}[] = [
  {
    id: "openai",
    label: "ChatGPT",
    login: "https://chatgpt.com",
    keys: "https://platform.openai.com/api-keys",
    setting: "openaiKey",
    header: "x-openai-key",
  },
  {
    id: "anthropic",
    label: "Claude",
    login: "https://claude.ai",
    keys: "https://console.anthropic.com/settings/keys",
    setting: "anthropicKey",
    header: "x-anthropic-key",
  },
  {
    id: "xai",
    label: "Grok",
    login: "https://grok.com",
    keys: "https://console.x.ai",
    setting: "xaiKey",
    header: "x-xai-key",
  },
  {
    id: "kimi",
    label: "Kimi",
    login: "https://www.kimi.com",
    keys: "https://platform.moonshot.ai/console/api-keys",
    setting: "kimiKey",
    header: "x-kimi-key",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    login: "https://chat.deepseek.com",
    keys: "https://platform.deepseek.com/api_keys",
    setting: "deepseekKey",
    header: "x-deepseek-key",
  },
];

export const FALLBACK_CLOUD: Record<CloudId, ModelRef[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", transport: "server", family: "gpt", contextLength: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o mini", provider: "openai", transport: "server", family: "gpt", contextLength: 128000 },
    { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", transport: "server", family: "gpt", contextLength: 1047576 },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
    { id: "claude-3-5-haiku-latest", name: "Claude Haiku 3.5", provider: "anthropic", transport: "server", family: "claude", contextLength: 200000 },
  ],
  xai: [
    { id: "grok-4.5", name: "Grok 4.5", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-4", name: "Grok 4", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-3", name: "Grok 3", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
    { id: "grok-3-mini", name: "Grok 3 Mini", provider: "xai", transport: "server", family: "grok", contextLength: 131072 },
  ],
  kimi: [
    { id: "kimi-k2-0905-preview", name: "Kimi K2", provider: "kimi", transport: "server", family: "kimi", contextLength: 256000 },
    { id: "moonshot-v1-128k", name: "Moonshot 128k", provider: "kimi", transport: "server", family: "kimi", contextLength: 128000 },
    { id: "moonshot-v1-32k", name: "Moonshot 32k", provider: "kimi", transport: "server", family: "kimi", contextLength: 32000 },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek", transport: "server", family: "deepseek", contextLength: 128000 },
    { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "deepseek", transport: "server", family: "deepseek", contextLength: 128000 },
  ],
};

export function cloudEndpoint(provider: CloudId, secret?: string) {
  if (provider === "openai") return { url: "https://api.openai.com/v1/chat/completions", models: "https://api.openai.com/v1/models" };
  if (provider === "xai") return { url: "https://api.x.ai/v1/chat/completions", models: "https://api.x.ai/v1/models" };
  if (provider === "kimi") {
    if (secret && !secret.startsWith("sk-")) {
      return {
        url: "https://api.kimi.com/coding/v1/chat/completions",
        models: "https://api.kimi.com/coding/v1/models",
      };
    }
    return { url: "https://api.moonshot.ai/v1/chat/completions", models: "https://api.moonshot.ai/v1/models" };
  }
  if (provider === "deepseek") return { url: "https://api.deepseek.com/chat/completions", models: "https://api.deepseek.com/models" };
  return { url: "https://api.anthropic.com/v1/messages", models: "https://api.anthropic.com/v1/models" };
}

export function cloudSecret(settings: Settings, provider: Provider) {
  if (provider === "openai") {
    if (settings.openaiOAuth?.accessToken) return settings.openaiOAuth.accessToken;
    return settings.openaiKey;
  }
  if (provider === "xai") {
    if (settings.xaiOAuth?.accessToken) return settings.xaiOAuth.accessToken;
    return settings.xaiKey;
  }
  if (provider === "kimi") {
    if (settings.kimiOAuth?.accessToken) return settings.kimiOAuth.accessToken;
    return settings.kimiKey;
  }
  if (provider === "ollama") return "";
  const account = CLOUD_ACCOUNTS.find((item) => item.id === provider);
  if (!account) return "";
  const value = settings[account.setting];
  return typeof value === "string" ? value : "";
}

export function isCloudSignedIn(settings: Settings, provider: Provider) {
  if (provider === "openai") return Boolean(settings.openaiOAuth?.accessToken);
  if (provider === "xai") return Boolean(settings.xaiOAuth?.accessToken);
  if (provider === "kimi") return Boolean(settings.kimiOAuth?.accessToken);
  return Boolean(cloudSecret(settings, provider));
}

export function oauthNote(provider: CloudId) {
  if (provider === "openai") {
    return "Sign in with ChatGPT in this app. A ChatGPT window opens — you do not need to enable device-code in Security Settings.";
  }
  if (provider === "xai") {
    return "Sign in with your Grok / SuperGrok account in this app. After you approve, Grok is available for chat and review.";
  }
  if (provider === "kimi") {
    return "Sign in with your Kimi account in this app. After you approve, Kimi is available for chat and review.";
  }
  if (provider === "anthropic") {
    return "Anthropic does not allow other apps to use a Claude.ai login. Sign in on their console, then paste an API key.";
  }
  return "DeepSeek does not offer in-app login for other apps. Sign in on their site, then paste an API key.";
}

export function reviewSatisfied(text: string) {
  const head = text.trim().slice(0, 200);
  return /^(SATISFIED|APPROVED|LGTM)\b/i.test(head) || /\bSATISFIED\b/i.test(head.split("\n")[0] ?? "");
}

export const REVIEW_SYSTEM =
  "You are the tester. You receive another model's full answer as your input. If it solves the user's request correctly, completely, and safely, start your reply with SATISFIED on its own first line, then one short note. If it is not good enough, do not write SATISFIED. Quote the errors and list concrete fixes. Your entire reply is passed back to the writer as its next input.";

export const FINAL_REVIEW_SYSTEM =
  "The revision cycles are over and the work is still not accepted. You are the tester. Write a final report for the user that includes: (1) the current project or answer as it stands, complete enough to use, (2) remaining errors that were not fixed, (3) what still must change. Put the project first, then your feedback. Do not write SATISFIED.";

export function handoffToTester(authorName: string, answer: string, cycle: number, max: number) {
  return `Cycle ${cycle}/${max}. Here is ${authorName}'s latest answer. Test it against the original request. If it is good, start with SATISFIED. If not, send concrete fixes — your full reply will be passed back to ${authorName}.\n\n${answer}`;
}

export function handoffToWriter(testerName: string, review: string) {
  return `Here is ${testerName}'s test of your last answer. Apply every point and reply with the complete updated work, not a patch. Your full reply will be passed back to the tester.\n\n${review}`;
}

export function finalHandoff(authorName: string, project: string) {
  return `The cycles are finished and the errors were not fully fixed. Here is the latest version of the project from ${authorName}:\n\n${project}\n\nWrite your final test report: include this project (or a cleaned-up restatement of it) together with the remaining errors that still need to be fixed.`;
}
