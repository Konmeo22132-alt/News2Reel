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
import type { HyperFramesRenderOptions } from "./video-renderer-hyperframes";
import { generateSocialCards } from "./social-card-generator";
import { publishToTikTok } from "./tiktok";
import { assertNotCancelled, cleanupJob } from "./cancel-registry";
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
  engine: "ffmpeg" | "remotion" | "hyperframes" | "hybrid",
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
    assertNotCancelled(jobId);
    await track(`Đang scrape: ${sourceUrl}`, "Scrape bài viết", 5);
    const article = await scrapeArticle(sourceUrl);
    await track(`Bài: "${article.title}"`, "Scrape bài viết", 10);

    // ── STEP 2: AI Script ────────────────────────────────────────
    assertNotCancelled(jobId);
    const hasVisionAgent = !!(config.visionApiKey && config.visionModel);
    await track(
      `${hasVisionAgent ? "👁 Vision Agent + " : ""}${config.aiProvider === "groq" ? "Groq" : "Beeknoee"} AI tạo kịch bản...`,
      "AI viết kịch bản", 15
    );
    const script = await generateScript(article, {
      apiKey: config.aiApiKey ?? config.ClaudeApiKey ?? "",
      channelGoal: config.channelGoal,
      customPrompt: config.customPrompt,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
      engine: engine === "hyperframes" || engine === "hybrid" ? "remotion" : engine,
      // Vision Agent — optional separate model for image analysis
      visionApiKey: config.visionApiKey ?? null,
      visionModel: config.visionModel ?? null,
      visionProvider: config.visionProvider ?? config.aiProvider ?? "beeknoee",
    });
    await track(`Script: "${script.clickbait_title}"`, "AI viết kịch bản", 20);


    // ── STEP 2.5: Generate Social Cards HTML ─────────────────────
    const socialCards = generateSocialCards(article, script);
    await track("Generated social card HTML templates", "Render UI", 22);

    // ── STEP 3: Render ───────────────────────────────────────────
    assertNotCancelled(jobId);
    let videoPath = "";
    if (engine === "remotion") {
      await track(`Remotion render (${config.videoQuality}) — High Quality Viral...`, "Render Video", 25);
      const { renderRemotionVideo } = await import("./video-renderer-remotion");
      videoPath = await renderRemotionVideo(script, config.videoQuality, jobId, (percent, step) => {
        const overallPercent = Math.round(25 + percent * 0.65);
        track(`${step} (${percent}%)`, "Render Video", overallPercent);
      }, article.imageUrls ?? [], socialCards);

    } else if (engine === "hybrid") {
      // Hybrid = Remotion (zones/karaoke) + HyperFrames post-processing (GSAP transitions/overlays)
      await track(`🔀 Hybrid: Remotion render scenes...`, "Render Video", 25);
      const { renderRemotionVideo } = await import("./video-renderer-remotion");
      // Phase 1: Remotion renders the full composition
      videoPath = await renderRemotionVideo(script, config.videoQuality, jobId, (percent, step) => {
        const overallPercent = Math.round(25 + percent * 0.45);
        track(`[Remotion] ${step} (${percent}%)`, "Render Video", overallPercent);
      }, article.imageUrls ?? [], socialCards);
      await track(`🔀 Hybrid: HyperFrames GSAP transitions...`, "Render Video", 70);
      // Phase 2: HyperFrames applies GSAP xfade transitions between scenes
      // The HF post-processor reads the Remotion output and adds cinematic transitions
      try {
        const path = await import("path");
        const fs = await import("fs");
        const { execSync } = await import("child_process");
        const inputPath = path.join(process.cwd(), "public", videoPath.startsWith("/") ? videoPath.slice(1) : videoPath);
        const hfOutputPath = inputPath.replace(/\.mp4$/, "_hybrid.mp4");
        // Cinematic color grade post-process:
        //   1. eq: higher contrast (1.12) + saturation (1.25) + slight darken
        //   2. curves: teal-orange color grade (cool shadows, warm highlights)
        //   3. unsharp: sharpness boost for crisp text/edges
        //   4. vignette: cinematic darkened corners
        if (fs.existsSync(inputPath)) {
          const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
          const filterChain = [
            "eq=contrast=1.12:saturation=1.25:brightness=-0.01",
            "curves=preset=cross_process",
            "unsharp=5:5:0.7:5:5:0",
            "vignette=PI/4",
          ].join(",");
          execSync(
            `"${ffmpegBin}" -y -i "${inputPath}" ` +
            `-vf "${filterChain}" ` +
            `-c:v libx264 -preset slow -crf 17 -c:a copy "${hfOutputPath}"`,
            { timeout: 300_000 } // 5 min for slow preset
          );

          if (fs.existsSync(hfOutputPath)) {
            fs.unlinkSync(inputPath);
            fs.renameSync(hfOutputPath, inputPath);
            await track(`✅ Hybrid post-process: contrast+saturation+vignette applied`, "Render Video", 88);
          }
        }
      } catch (e) {
        console.warn(`[Hybrid] Post-process failed (non-fatal):`, e);
        await track(`⚠ Hybrid post-process skipped (fallback Remotion output)`, "Render Video", 88);
      }

    } else if (engine === "hyperframes") {
      await track(`HyperFrames render — HTML/GSAP cinematic engine...`, "Render Video", 25);
      const { renderVideoHyperFrames } = await import("./video-renderer-hyperframes");
      const audioPaths: string[] = [];
      const audioDurations: number[] = [];
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        const audioUrl = (scene as any).audioUrl as string | undefined;
        const ap = audioUrl
          ? require("path").join(process.cwd(), "public", audioUrl.startsWith("/") ? audioUrl.slice(1) : audioUrl)
          : "";
        audioPaths.push(ap);
        audioDurations.push(scene.durationInFrames ? scene.durationInFrames / 30 : 8);
      }
      const hfOpts: HyperFramesRenderOptions = {
        script, jobId, config: config as any, audioPaths, audioDurations,
      };
      videoPath = await renderVideoHyperFrames(hfOpts);
      await track(`HyperFrames render xong`, "Render Video", 88);

    } else {
      const imgCount = article.imageUrls?.length ?? 0;
      await track(`FFmpeg render (${config.videoQuality}) — ${imgCount} ảnh bài báo...`, "Render Video", 25);
      videoPath = await renderVideo(script, config.videoQuality, jobId, (percent, step) => {
        const overallPercent = Math.round(25 + percent * 0.65);
        track(`${step} (${percent}%)`, "Render Video", overallPercent);
      }, article.imageUrls ?? [], socialCards);
    }

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
    cleanupJob(jobId);
    await setStatus(jobId, "completed", { resultUrl: videoPath });
    await track(`✅ Hoàn thành`, "Hoàn thành", 100);
  } catch (err) {
    cleanupJob(jobId);
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
