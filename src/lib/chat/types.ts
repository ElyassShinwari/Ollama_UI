export type Provider = "ollama" | "openai" | "anthropic" | "xai" | "kimi" | "deepseek";
export type Transport = "browser" | "server";
export type ThemeMode = "light" | "dark" | "system";

export type ModelRef = {
  id: string;
  name: string;
  provider: Provider;
  transport: Transport;
  size?: number;
  family?: string;
  parameterSize?: string;
  contextLength?: number;
  capabilities?: string[];
};

export type Role = "user" | "assistant" | "system";

export type MessageAttachment = {
  name: string;
  kind: "txt" | "image" | "file";
};

export type MessageDocument = {
  name: string;
  mime: string;
  data: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  modelId?: string;
  modelName?: string;
  createdAt: number;
  parentId?: string | null;
  selectedChildId?: string | null;
  images?: string[];
  documents?: MessageDocument[];
  attachments?: MessageAttachment[];
};

export type Conversation = {
  id: string;
  title: string;
  model: ModelRef;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  activeRootId?: string | null;
  promptTokens: number;
  completionTokens: number;
  contextTokens: number;
  contextExceeded?: boolean;
};

export type OAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string;
  accountId?: string;
};

export type Settings = {
  ollamaHost: string;
  temperature: number;
  systemPrompt: string;
  theme: ThemeMode;
  openaiKey: string;
  anthropicKey: string;
  xaiKey: string;
  kimiKey: string;
  deepseekKey: string;
  openaiOAuth: OAuthSession | null;
  xaiOAuth: OAuthSession | null;
  kimiOAuth: OAuthSession | null;
};

export type CatalogStatus = {
  loading: boolean;
  ollamaBrowser: boolean;
  ollamaServer: boolean;
  xai: boolean;
  openai: boolean;
  anthropic: boolean;
  kimi: boolean;
  deepseek: boolean;
  error?: string;
};

export type ModelCatalog = {
  models: ModelRef[];
  status: CatalogStatus;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
};
