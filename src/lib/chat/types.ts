export type Provider = "ollama" | "xai";
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
};

export type Role = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: Role;
  content: string;
  modelId?: string;
  createdAt: number;
  parentId?: string | null;
  selectedChildId?: string | null;
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

export type Settings = {
  ollamaHost: string;
  temperature: number;
  systemPrompt: string;
  theme: ThemeMode;
};

export type CatalogStatus = {
  loading: boolean;
  ollamaBrowser: boolean;
  ollamaServer: boolean;
  xai: boolean;
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
