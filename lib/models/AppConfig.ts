import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAppConfig extends Document {
  deepseekApiKey: string | null;
  videoQuality: string;
  dailyVideoLimit: number;
  newsSources: string; // JSON array string
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
