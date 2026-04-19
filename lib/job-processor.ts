/**
 * Job Processor — main pipeline orchestrator.
 * Pipeline: Scrape → AI Script → Render Video → [TikTok Post]
 */

import { cleanupStaleFiles } from "./cleanup";
import { connectDB } from "./mongodb";
import { VideoJobModel } from "./models/VideoJob";
import { scrapeArticle } from "./scraper";
import { generateScript } from "./ai";
import { renderVideo } from "./video-renderer";
import { generateSocialCards } from "./social-card-generator";
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

async function dbLog(jobId: string, msg: string, step?: string, progress?: number) {
  await connectDB();
  const updateData: any = { $push: { logs: msg } };
  if (step || progress !== undefined) {
    if (!updateData.$set) updateData.$set = {};
    if (step) updateData.$set.currentStep = step;
    if (progress !== undefined) updateData.$set.progress = progress;
  }
  await VideoJobModel.updateOne({ jobId }, updateData).catch(() => {});
}

export async function processVideoJob(
  jobId: string,
  sourceUrl: string,
  config: AppConfig,
  log: (msg: string) => void = console.log
): Promise<void> {
  // Fire-and-forget stale cleanup to save VPS memory
  Promise.resolve().then(() => cleanupStaleFiles());

  try {
    if (!config.aiApiKey && !config.ClaudeApiKey) {
      throw new Error("Chưa cấu hình API Key trong Settings");
    }

    await setStatus(jobId, "processing");

    const track = (msg: string, step?: string, progress?: number) => {
      log(`[${jobId.slice(0, 8)}] ${msg}`);
      return dbLog(jobId, msg, step, progress); // fire and forget can be risky if node dies, so we return promise
    };

    // ── STEP 1: Scrape ──────────────────────────────────────────
    await track(`Đang scrape: ${sourceUrl}`, "Scrape bài viết", 5);
    const article = await scrapeArticle(sourceUrl);
    await track(`Bài: "${article.title}"`, "Scrape bài viết", 10);

    // ── STEP 2: AI Script ────────────────────────────────────────
    await track(`${config.aiProvider === "groq" ? "Groq" : "Beeknoee"} AI tạo kịch bản...`, "AI viết kịch bản", 15);
    const script = await generateScript(article, {
      apiKey: config.aiApiKey ?? config.ClaudeApiKey ?? "",
      channelGoal: config.channelGoal,
      customPrompt: config.customPrompt,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
    });
    await track(`Script: "${script.clickbait_title}"`, "AI viết kịch bản", 20);

    // ── STEP 2.5: Generate Social Cards HTML ─────────────────────
    const socialCards = generateSocialCards(article, script);
    await track("Generated social card HTML templates", "Render UI", 22);

    // ── STEP 3: Render ───────────────────────────────────────────
    const imgCount = article.imageUrls?.length ?? 0;
    await track(`FFmpeg render (${config.videoQuality}) — ${imgCount} ảnh bài báo...`, "Render Video", 25);
    const videoPath = await renderVideo(script, config.videoQuality, jobId, (percent, step) => {
      const overallPercent = Math.round(25 + percent * 0.65);
      track(`${step} (${percent}%)`, "Render Video", overallPercent);
    }, article.imageUrls ?? [], socialCards);
    await track(`Render xong: ${videoPath}`, "Render Video", 90);

    // ── STEP 4: TikTok (optional) ────────────────────────────────
    if (config.autoPostEnabled && config.tiktokApiKey && config.tiktokApiSecret) {
      await track(`Đăng lên TikTok...`, "Đăng TikTok", 95);
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
    await track(`✅ Hoàn thành`, "Hoàn thành", 100);
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
