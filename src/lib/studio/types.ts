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
  instructions: InstructionPreset[];
  knowledge: KnowledgeDoc[];
  knowledgeEnabled: boolean;
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
});
