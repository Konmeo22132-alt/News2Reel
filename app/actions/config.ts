"use server";

import { connectDB } from "@/lib/mongodb";
import { AppConfigModel } from "@/lib/models/AppConfig";
import { VideoJobModel } from "@/lib/models/VideoJob";
import { revalidatePath } from "next/cache";
import type { AppConfig, VideoJob } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<AppConfig> {
  await connectDB();
  let doc = await AppConfigModel.findOne().lean();
  if (!doc) {
    const created = await AppConfigModel.create({});
    doc = created.toObject();
  }
  return mongoToConfig(doc);
}

export type ConfigFormData = {
  deepseekApiKey?: string;
  videoQuality?: string;
  dailyVideoLimit?: number;
  newsSources?: string;
  channelGoal?: string;
  tiktokApiKey?: string;
  tiktokApiSecret?: string;
  autoPostEnabled?: boolean;
  customPrompt?: string;
};

export async function updateConfig(
  data: ConfigFormData
): Promise<{ success: boolean; message: string }> {
  try {
    await connectDB();
    await AppConfigModel.findOneAndUpdate(
      {},
      {
        $set: {
          ...(data.deepseekApiKey !== undefined && { deepseekApiKey: data.deepseekApiKey || null }),
          ...(data.videoQuality !== undefined && { videoQuality: data.videoQuality }),
          ...(data.dailyVideoLimit !== undefined && { dailyVideoLimit: data.dailyVideoLimit }),
          ...(data.newsSources !== undefined && { newsSources: data.newsSources }),
          ...(data.channelGoal !== undefined && { channelGoal: data.channelGoal }),
          ...(data.tiktokApiKey !== undefined && { tiktokApiKey: data.tiktokApiKey || null }),
          ...(data.tiktokApiSecret !== undefined && { tiktokApiSecret: data.tiktokApiSecret || null }),
          ...(data.autoPostEnabled !== undefined && { autoPostEnabled: data.autoPostEnabled }),
          ...(data.customPrompt !== undefined && { customPrompt: data.customPrompt || null }),
        },
      },
      { upsert: true, new: true }
    );
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Cấu hình đã được lưu thành công" };
  } catch (err) {
    console.error("updateConfig error:", err);
    return { success: false, message: "Lỗi khi lưu cấu hình, vui lòng thử lại" };
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [config, todayCompleted, recentJobDocs, dailyUsage] = await Promise.all([
    getConfig(),
    VideoJobModel.countDocuments({ status: "completed", createdAt: { $gte: today, $lt: tomorrow } }),
    VideoJobModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    VideoJobModel.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
  ]);

  return {
    config,
    todayCompleted,
    recentJobs: recentJobDocs.map(mongoToJob),
    dailyUsage,
  };
}

// ─── Video History ────────────────────────────────────────────────────────────

export async function getVideoHistory(page = 1, limit = 100) {
  await connectDB();
  const skip = (page - 1) * limit;
  const [jobDocs, total] = await Promise.all([
    VideoJobModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    VideoJobModel.countDocuments(),
  ]);
  return { jobs: jobDocs.map(mongoToJob) as VideoJob[], total, page, limit };
}

// ─── Job Helpers ──────────────────────────────────────────────────────────────

export async function getJobByJobId(jobId: string): Promise<VideoJob | null> {
  await connectDB();
  const doc = await VideoJobModel.findOne({ jobId }).lean();
  if (!doc) return null;
  return mongoToJob(doc);
}

export async function countTodayJobs(): Promise<number> {
  await connectDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return VideoJobModel.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mongoToConfig(doc: any): AppConfig {
  return {
    id: 1,
    deepseekApiKey: doc.deepseekApiKey ?? null,
    videoQuality: doc.videoQuality ?? "720p",
    dailyVideoLimit: doc.dailyVideoLimit ?? 10,
    newsSources: doc.newsSources ?? "[]",
    channelGoal: doc.channelGoal ?? "ads",
    tiktokApiKey: doc.tiktokApiKey ?? null,
    tiktokApiSecret: doc.tiktokApiSecret ?? null,
    autoPostEnabled: doc.autoPostEnabled ?? false,
    customPrompt: doc.customPrompt ?? null,
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mongoToJob(doc: any): VideoJob {
  return {
    id: doc.jobId ?? String(doc._id),
    sourceUrl: doc.sourceUrl,
    status: doc.status,
    resultUrl: doc.resultUrl ?? null,
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? null,
  };
}

export { uuidv4 };
