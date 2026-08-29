export type McpTransport = "stdio" | "sse" | "http";

export type McpServerConfig = {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpTransport;
  command?: string;
  args?: string;
  url?: string;
};

export type ClonedRepo = {
  id: string;
  name: string;
  url: string;
  path: string;
  pulledAt: number;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  text: string;
  source: "chat" | "file" | "repo" | "manual";
  createdAt: number;
};

export type InstructionPreset = {
  id: string;
  name: string;
  text: string;
  enabled: boolean;
};

export type ChannelKind = "website" | "whatsapp" | "instagram" | "telegram" | "webhook";

export type StudioConfig = {
  githubToken: string;
  repos: ClonedRepo[];
  mcpServers: McpServerConfig[];
  apiEnabled: boolean;
  apiKey: string;
  channelSecret: string;
  channelVerify: string;
  defaultModel: string;
  ollamaHost: string;
  instructions: InstructionPreset[];
  knowledge: KnowledgeDoc[];
  knowledgeEnabled: boolean;
  n8nKind: "local" | "cloud" | "server";
  n8nBaseUrl: string;
  n8nApiKey: string;
  n8nWebhookUrl: string;
  n8nSecret: string;
  n8nEnabled: boolean;
  n8nSendOnChat: boolean;
};

export const defaultStudio = (): StudioConfig => ({
  githubToken: "",
  repos: [],
  mcpServers: [],
  apiEnabled: true,
  apiKey: "",
  channelSecret: "",
  channelVerify: "ollama-ui",
  defaultModel: "",
  ollamaHost: "http://127.0.0.1:11434",
  instructions: [
    {
      id: "helpful",
      name: "Helpful assistant",
      text: "You are a careful local assistant. Be direct. If you are unsure, say so.",
      enabled: false,
    },
  ],
  knowledge: [],
  knowledgeEnabled: true,
  n8nKind: "local",
  n8nBaseUrl: "http://127.0.0.1:5678",
  n8nApiKey: "",
  n8nWebhookUrl: "",
  n8nSecret: "",
  n8nEnabled: true,
  n8nSendOnChat: false,
});
