/**
 * Job Processor — main pipeline orchestrator.
 * Pipeline: Scrape → AI Script → Render Video → [TikTok Post]
 */

import { connectDB } from "./mongodb";
import { VideoJobModel } from "./models/VideoJob";
import { scrapeArticle } from "./scraper";
import { generateScript } from "./ai";
import { renderVideo } from "./video-renderer";
import { publishToTikTok } from "./tiktok";
import type { AppConfig } from "./types";

async function setStatus(
  jobId: string,
  status: string,
  extra: { resultUrl?: string } = {}
) {
  await connectDB();
  await VideoJobModel.findOneAndUpdate(
    { jobId },
    {
      $set: {
        status,
        ...extra,
        ...(status === "completed" || status === "failed"
          ? { completedAt: new Date(), currentStep: status === "completed" ? "Hoàn thành" : "Thất bại" }
          : {}),
      },
    }
  );
}

async function dbLog(jobId: string, msg: string, step?: string) {
  await connectDB();
  const updateData: any = { $push: { logs: msg } };
  if (step) {
    if (!updateData.$set) updateData.$set = {};
    updateData.$set.currentStep = step;
  }
  await VideoJobModel.updateOne({ jobId }, updateData).catch(() => {});
}

export async function processVideoJob(
  jobId: string,
  sourceUrl: string,
  config: AppConfig,
  log: (msg: string) => void = console.log
): Promise<void> {
  try {
    if (!config.aiApiKey && !config.deepseekApiKey) {
      throw new Error("Chưa cấu hình API Key trong Settings");
    }

    await setStatus(jobId, "processing");

    const track = (msg: string, step?: string) => {
      log(`[${jobId.slice(0, 8)}] ${msg}`);
      return dbLog(jobId, msg, step); // fire and forget can be risky if node dies, so we return promise
    };

    // ── STEP 1: Scrape ──────────────────────────────────────────
    await track(`Đang scrape: ${sourceUrl}`, "Scrape bài viết");
    const article = await scrapeArticle(sourceUrl);
    await track(`Bài: "${article.title}"`);

    // ── STEP 2: AI Script ────────────────────────────────────────
    await track(`${config.aiProvider === "groq" ? "Groq" : "Beeknoee"} AI tạo kịch bản...`, "AI viết kịch bản");
    const script = await generateScript(article, {
      apiKey: config.aiApiKey ?? config.deepseekApiKey ?? "",
      channelGoal: config.channelGoal,
      customPrompt: config.customPrompt,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
    });
    await track(`Script: "${script.title}"`);

    // ── STEP 3: Render ───────────────────────────────────────────
    await track(`FFmpeg render (${config.videoQuality})...`, "Render Video");
    const videoPath = await renderVideo(script, config.videoQuality, jobId);
    await track(`Render xong: ${videoPath}`);

    // ── STEP 4: TikTok (optional) ────────────────────────────────
    if (config.autoPostEnabled && config.tiktokApiKey && config.tiktokApiSecret) {
      await track(`Đăng lên TikTok...`, "Đăng TikTok");
      try {
        await publishToTikTok(
          videoPath,
          `${script.hook}\n\n${script.callToAction}`,
          { appKey: config.tiktokApiKey, appSecret: config.tiktokApiSecret }
        );
        await track(`TikTok OK`);
      } catch (tikErr) {
        await track(`TikTok warning: ${tikErr instanceof Error ? tikErr.message : String(tikErr)}`);
      }
    }

    // ── DONE ─────────────────────────────────────────────────────
    await setStatus(jobId, "completed", { resultUrl: videoPath });
    await track(`✅ Hoàn thành`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[${jobId.slice(0, 8)}] ❌ Lỗi: ${msg}`);
    
    // Lưu thẳng logs và errorDetails
    await connectDB();
    await VideoJobModel.updateOne(
      { jobId },
      {
        $set: { status: "failed", currentStep: "Thất bại", errorDetails: msg, completedAt: new Date() },
        $push: { logs: `❌ Lỗi: ${msg}` }
      }
    ).catch(() => {});
    
    throw err;
  }
}
