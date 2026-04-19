import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VideoJobModel } from "@/lib/models/VideoJob";
import { getConfig, countTodayJobs } from "@/app/actions/config";
import { processVideoJob } from "@/lib/job-processor";
import type { AppConfig } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceUrl = (body?.sourceUrl ?? "").trim();
    const engine = body?.engine === "remotion" ? "remotion" : "ffmpeg";

    if (!sourceUrl || !sourceUrl.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "URL không hợp lệ" },
        { status: 400 }
      );
    }

    const config = await getConfig();
    const todayCount = await countTodayJobs();
    if (todayCount >= config.dailyVideoLimit) {
      return NextResponse.json(
        { success: false, error: `Đã đạt giới hạn ${config.dailyVideoLimit} video/ngày` },
        { status: 429 }
      );
    }

    await connectDB();
    const jobId = uuidv4();
    await VideoJobModel.create({ jobId, sourceUrl, status: "pending", engine });

    Promise.resolve()
      .then(() => processVideoJob(jobId, sourceUrl, engine, config as AppConfig))
      .catch((err) => console.error(`[Job ${jobId}] Background task failed:`, err));

    return NextResponse.json({ success: true, jobId, message: "Pipeline đã khởi động" });
  } catch (err) {
    console.error("trigger error:", err);
    return NextResponse.json({ success: false, error: "Lỗi server nội bộ" }, { status: 500 });
  }
}
