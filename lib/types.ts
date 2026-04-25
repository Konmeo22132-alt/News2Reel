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
  aiApiKey: string | null;       // Script-writing API key
  aiModel: string | null;        // Script-writing model
  // Vision Agent (optional)
  visionProvider: string | null;
  visionApiKey: string | null;
  visionModel: string | null;
  videoQuality: string;
  dailyVideoLimit: number;
  newsSources: string;
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
  context_image_url?: string;
  hook: string;
  scenes: ScriptScene[];
  callToAction: string;
};

export type ScriptScene = {
  narration: string;
  // Shared image field — URL ảnh thực tế từ scraper (AI chọn phù hợp nhất cho scene)
  context_image_url?: string;
  // Convenience aliases for HyperFrames renderer
  imageUrl?: string;          // alias for context_image_url
  audioUrl?: string;          // TTS audio file URL (/api/stream/... or absolute path)
  isHook?: boolean;           // is this the hook scene
  isCTA?: boolean;            // is this the call-to-action scene
  // FFmpeg fields
  duration?: number;
  context_image_index?: number;
  // Remotion fields
  durationInFrames?: number;
  animationType?: "SocialTweet" | "Earth3D" | "HackerTerminal" | "ImpactCallout" | "PointToPoint" | "SplitScreenVS" | "DataChart" | "WarningAlert";
  animationProps?: any;
};

export type JobResult =
  | { success: true; resultUrl: string }
  | { success: false; error: string };
