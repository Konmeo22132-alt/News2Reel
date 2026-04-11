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
          ? { completedAt: new Date() }
          : {}),
      },
    }
  );
}

export async function processVideoJob(
  jobId: string,
  sourceUrl: string,
  config: AppConfig,
  log: (msg: string) => void = console.log
): Promise<void> {
  try {
    if (!config.deepseekApiKey) {
      throw new Error("Chưa cấu hình DeepSeek API Key trong Settings");
    }

    await setStatus(jobId, "processing");

    // ── STEP 1: Scrape ──────────────────────────────────────────
    log(`[${jobId.slice(0, 8)}] Đang scrape: ${sourceUrl}`);
    const article = await scrapeArticle(sourceUrl);
    log(`[${jobId.slice(0, 8)}] Bài: "${article.title}"`);

    // ── STEP 2: AI Script ────────────────────────────────────────
    log(`[${jobId.slice(0, 8)}] DeepSeek AI tạo kịch bản...`);
    const script = await generateScript(article, {
      deepseekApiKey: config.deepseekApiKey,
      channelGoal: config.channelGoal,
      customPrompt: config.customPrompt,
    });
    log(`[${jobId.slice(0, 8)}] Script: "${script.title}"`);

    // ── STEP 3: Render ───────────────────────────────────────────
    log(`[${jobId.slice(0, 8)}] FFmpeg render (${config.videoQuality})...`);
    const videoPath = await renderVideo(script, config.videoQuality, jobId);
    log(`[${jobId.slice(0, 8)}] Render xong: ${videoPath}`);

    // ── STEP 4: TikTok (optional) ────────────────────────────────
    if (config.autoPostEnabled && config.tiktokApiKey && config.tiktokApiSecret) {
      log(`[${jobId.slice(0, 8)}] Đăng lên TikTok...`);
      try {
        await publishToTikTok(
          videoPath,
          `${script.hook}\n\n${script.callToAction}`,
          { appKey: config.tiktokApiKey, appSecret: config.tiktokApiSecret }
        );
        log(`[${jobId.slice(0, 8)}] TikTok OK`);
      } catch (tikErr) {
        log(`[${jobId.slice(0, 8)}] TikTok warning: ${tikErr instanceof Error ? tikErr.message : String(tikErr)}`);
      }
    }

    // ── DONE ─────────────────────────────────────────────────────
    await setStatus(jobId, "completed", { resultUrl: videoPath });
    log(`[${jobId.slice(0, 8)}] ✅ Hoàn thành`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[${jobId.slice(0, 8)}] ❌ Lỗi: ${msg}`);
    await setStatus(jobId, "failed").catch(() => {});
    throw err;
  }
}
