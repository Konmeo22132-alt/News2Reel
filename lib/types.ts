// Shared domain types — mirrors Prisma models exactly

export type VideoJob = {
  id: string;
  sourceUrl: string;
  status: string; // pending | processing | completed | failed
  resultUrl: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type AppConfig = {
  id: number;
  ClaudeApiKey: string | null; // legacy
  aiProvider: string;            // "beeknoee" | "groq"
  aiApiKey: string | null;       // active API key
  aiModel: string | null;        // active model name
  videoQuality: string;
  dailyVideoLimit: number;
  newsSources: string; // JSON array string
  channelGoal: string;
  tiktokApiKey: string | null;
  tiktokApiSecret: string | null;
  autoPostEnabled: boolean;
  customPrompt: string | null;
  updatedAt: Date;
};

export type ScrapedArticle = {
  title: string;
  content: string;
  url: string;
};

// Visual IDs for scene visuals (matches AI script engine)
export const VISUAL_IDS = [
  "laptop", "rocket", "skull", "warning", "code_window",
  "terminal", "robot", "chip", "globe", "lock",
  "chart", "dollar", "fire", "star", "lightning",
] as const;

export type VisualID = typeof VISUAL_IDS[number];

export type VideoScript = {
  title: string;
  hook: string;       // First 3s attention grabber
  scenes: ScriptScene[];
  callToAction: string;
};

export type ScriptScene = {
  narration: string;  // Text to display / narrate (may include <keyword> tags)
  duration: number;   // Seconds
  visual_id: VisualID; // Visual element for this scene
  bgColor?: string;
};

export type JobResult =
  | { success: true; resultUrl: string }
  | { success: false; error: string };
