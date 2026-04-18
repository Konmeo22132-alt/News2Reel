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
  "turtle", "shield", "dna", "bell", "scale",
] as const;

export type VisualID = typeof VISUAL_IDS[number];

/**
 * Scene type controls HOW the scene is rendered.
 * - normal:       Gradient + emoji icon + scene title + karaoke subtitle
 * - counter:      Giant glowing number counting up (0 → N) + label
 * - vs_screen:    Two side-by-side boxes comparing A vs B
 * - terminal:     Mac terminal window with typewriter text lines
 * - checklist:    Staggered checklist lines appearing one by one
 * - progress_bar: Horizontal bar filling from 0 to target%
 */
export type SceneType =
  | "normal"
  | "counter"
  | "vs_screen"
  | "terminal"
  | "checklist"
  | "progress_bar";

export type VideoScript = {
  title: string;
  hook: string;       // First 3s attention grabber
  scenes: ScriptScene[];
  callToAction: string;
};

export type ScriptScene = {
  narration: string;    // Text to display / narrate (may include <keyword> tags)
  duration: number;     // Seconds
  visual_id: VisualID;  // Emoji icon for this scene
  scene_type?: SceneType; // Defaults to "normal" if omitted

  // For scene_type === "counter"
  counter_end?: number;           // e.g. 22, 200
  counter_label?: string;         // e.g. "lỗ hổng trong 2 tuần"
  counter_suffix?: string;        // e.g. "%" or "" or "M"
  counter_prefix?: string;        // e.g. "" or "$"

  // For scene_type === "vs_screen"
  vs_left?: string;               // e.g. "Human Response"
  vs_right?: string;              // e.g. "AI Speed"
  vs_left_color?: string;         // hex, default "#8B0000"
  vs_right_color?: string;        // hex, default "#003B1E"

  // For scene_type === "terminal"
  terminal_title?: string;        // e.g. "CVE-2026-2796"
  terminal_lines?: string[];      // e.g. ["> exploit --target ...", "// Running..."]

  // For scene_type === "checklist"
  checklist_items?: string[];     // e.g. ["Update Firefox", "Bật Sandbox", "Cảnh giác Wasm"]

  // For scene_type === "progress_bar"
  progress_target?: number;       // e.g. 40 (= 40%)
  progress_label?: string;        // e.g. "Internet dùng WordPress"
};

export type JobResult =
  | { success: true; resultUrl: string }
  | { success: false; error: string };
