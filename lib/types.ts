export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  summary: string | null;
  firstMessageTime: string;
  lastMessageTime: string;
  filePath: string;
}

export interface Message {
  uuid: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface RawMessage {
  type: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: string | ContentItem[];
  };
  summary?: string;
}

export interface ContentItem {
  type: string;
  text?: string;
  thinking?: string;
}
