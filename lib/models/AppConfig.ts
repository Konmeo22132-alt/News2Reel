import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAppConfig extends Document {
  deepseekApiKey: string | null;  // legacy field, kept for backward compat
  aiProvider: string;             // "beeknoee" | "groq"
  aiApiKey: string | null;        // Script-writing API key
  aiModel: string | null;         // Script-writing model
  // Vision Agent (optional — reads images, briefs script writer)
  visionProvider: string | null;  // "beeknoee" | "groq" | null
  visionApiKey: string | null;    // Separate key for vision model
  visionModel: string | null;     // Vision model (e.g. gpt-4o, claude-3-haiku)
  videoQuality: string;
  dailyVideoLimit: number;
  newsSources: string;
  channelGoal: string;
  tiktokApiKey: string | null;
  tiktokApiSecret: string | null;
  autoPostEnabled: boolean;
  customPrompt: string | null;
  updatedAt: Date;
}

const AppConfigSchema = new Schema<IAppConfig>(
  {
    deepseekApiKey: { type: String, default: null },
    aiProvider: { type: String, default: "beeknoee" },
    aiApiKey: { type: String, default: null },
    aiModel: { type: String, default: null },
    visionProvider: { type: String, default: null },
    visionApiKey: { type: String, default: null },
    visionModel: { type: String, default: null },
    videoQuality: { type: String, default: "720p" },
    dailyVideoLimit: { type: Number, default: 10 },
    newsSources: { type: String, default: "[]" },
    channelGoal: { type: String, default: "ads" },
    tiktokApiKey: { type: String, default: null },
    tiktokApiSecret: { type: String, default: null },
    autoPostEnabled: { type: Boolean, default: false },
    customPrompt: { type: String, default: null },
  },
  {
    timestamps: { createdAt: false, updatedAt: "updatedAt" },
    collection: "app_config",
  }
);

// Singleton pattern — only one config document
export const AppConfigModel: Model<IAppConfig> =
  mongoose.models.AppConfig ??
  mongoose.model<IAppConfig>("AppConfig", AppConfigSchema);
