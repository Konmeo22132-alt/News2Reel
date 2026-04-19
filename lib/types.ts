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
  imageUrls: string[];  // Article images extracted by scraper (OG + content images)
};

export type VideoScript = {
  clickbait_title: string;
  fake_username: string;
  hook: string;
  scenes: ScriptScene[];
  callToAction: string;
};

export type ScriptScene = {
  narration: string;
  duration: number;
  context_image_index?: number;
};

export type JobResult =
  | { success: true; resultUrl: string }
  | { success: false; error: string };
