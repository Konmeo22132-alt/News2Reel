import mongoose, { Schema, Model } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IVideoJob {
  jobId: string;
  sourceUrl: string;
  status: string;
  resultUrl: string | null;
  logs: string[];
  currentStep: string;
  progress: number;
  errorDetails: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// Do not use Schema<IVideoJob> — Mongoose's generic type conflicts with custom fields.
// Use plain Schema and cast the Model explicitly.
const VideoJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, default: uuidv4 },
    sourceUrl: { type: String, required: true },
    status: { type: String, default: "pending" },
    resultUrl: { type: String, default: null },
    logs: { type: [String], default: [] },
    currentStep: { type: String, default: "Đang khởi tạo" },
    errorDetails: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    collection: "video_jobs",
  }
);

VideoJobSchema.index({ createdAt: -1 });
VideoJobSchema.index({ status: 1 });
// Note: jobId already has an implicit unique index via `unique: true` — do NOT add schema.index({ jobId: 1 }) again

// Cast to Model<IVideoJob> for type-safe queries
export const VideoJobModel = (
  mongoose.models["VideoJob"] ?? mongoose.model("VideoJob", VideoJobSchema)
) as Model<IVideoJob>;
