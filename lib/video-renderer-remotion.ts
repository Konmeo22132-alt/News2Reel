import { exec } from "child_process";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import util from "util";
import { VideoScript } from "./types";
import { textToSpeech, getAudioDuration, tempMp3Path } from "./tts";

const execAsync = util.promisify(exec);

async function downloadArticleImage(url: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": new URL(url).origin,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null; 
    fs.writeFileSync(destPath, buffer);
    return destPath;
  } catch (e) {
    return null;
  }
}

export async function renderRemotionVideo(
  script: VideoScript,
  quality: string,
  jobId: string,
  onProgress: (percent: number, step: string) => void,
  articleImageUrls?: string[],
  socialCards?: { twitterCardHtml: string; commentsCardHtml: string }
): Promise<string> {
  const publicDir = path.join(process.cwd(), "public");
  const remotionAssetsDir = path.join(publicDir, "remotion-assets", jobId);
  await fsPromises.mkdir(remotionAssetsDir, { recursive: true });

  const propsFile = path.join(remotionAssetsDir, `props.json`);
  const outFile = path.join(publicDir, "videos", `video_${jobId}_remotion.mp4`);

  try {
    // 1. Download Article Images to public directory
    const downloadedImages: (string | null)[] = [];
    if (articleImageUrls && articleImageUrls.length > 0) {
      onProgress(2, `Tải ${articleImageUrls.length} ảnh bài báo...`);
      for (let idx = 0; idx < Math.min(articleImageUrls.length, 6); idx++) {
        const ext = articleImageUrls[idx].includes(".webp") ? ".webp" : ".jpg";
        const imgPath = path.join(remotionAssetsDir, `img_${idx}${ext}`);
        const result = await downloadArticleImage(articleImageUrls[idx], imgPath);
        downloadedImages.push(result ? `remotion-assets/${jobId}/img_${idx}${ext}` : null);
      }
    }

    // 2. Generate TTS for all scenes
    const allScenes = [
      { narration: script.hook, isHook: true, isCTA: false, animationType: "NewsPhoto", animationProps: {} },
      ...script.scenes.map((s) => ({
        narration: s.narration,
        isHook: false,
        isCTA: false,
        animationType: s.animationType,
        animationProps: s.animationProps
      })),
      { narration: script.callToAction, isHook: false, isCTA: true, animationType: "NewsPhoto", animationProps: {} },
    ];

    let absoluteTotalFrames = 0;
    const finalScenesProps = [];

    const totalSteps = allScenes.length;
    for (let i = 0; i < totalSteps; i++) {
        const scene = allScenes[i];
        onProgress(10 + Math.round((i / totalSteps) * 20), `TTS cảnh ${i + 1}/${totalSteps}...`);
        
        const mp3FileName = `vox_${i}.mp3`;
        const mp3Path = path.join(remotionAssetsDir, mp3FileName);
        const ttsNarration = scene.narration.replace(/<\/?keyword>/gi, "");
        await textToSpeech(ttsNarration, mp3Path, { voice: "vi-VN-NamMinhNeural", rate: "+20%" });
        
        const durationSec = await getAudioDuration(mp3Path);
        const durationFrames = Math.ceil(durationSec * 30) + 15;
        absoluteTotalFrames += durationFrames;
        
        let imgUrl: string | null = null;
        if (downloadedImages.length > 0) {
           imgUrl = downloadedImages[i % downloadedImages.length] || null;
        }

        finalScenesProps.push({
            narration: scene.narration,
            audioUrl: `remotion-assets/${jobId}/${mp3FileName}`,
            durationInFrames: durationFrames,
            isHook: scene.isHook,
            isCTA: scene.isCTA,
            imageUrl: imgUrl,
            animationType: scene.animationType || "NewsPhoto",
            animationProps: scene.animationProps || {}
        });
    }

    // 3. Inject Props
    const remotionProps = {
        script: {
            ...script,
            scenes: finalScenesProps,
            downloadedImages: downloadedImages.filter(Boolean)
        }
    };
    
    await fsPromises.writeFile(propsFile, JSON.stringify(remotionProps), "utf-8");

    // 4. Execute Remotion
    onProgress(35, `Đang khởi động Remotion Engine (${absoluteTotalFrames} frames)...`);

    const remotionCmd = `npx remotion render remotion/index.ts AutoVideoComposition "${outFile}" --props="${propsFile}" --frames=0-${absoluteTotalFrames - 1} --log=info --timeout=120000 --concurrency=1`;

    const child = exec(remotionCmd);

    child.stdout?.on("data", (data: string) => {
      const match = data.toString().match(/\[(\d+)\/(\d+)\]/);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (total > 0) {
          const pct = Math.floor((current / total) * 100);
          const totalBars = 20;
          const filledBars = Math.floor((pct / 100) * totalBars);
          const emptyBars = totalBars - filledBars;
          const barStr = `[${"#".repeat(filledBars)}${"=".repeat(emptyBars)}] ${pct}%`;
          onProgress(35 + pct * 0.60, `Đang render React: ${barStr}`);
        }
      }
    });

    child.stderr?.on("data", (data: string) => {
      console.log(`[Remotion ${jobId}] ${data.toString()}`);
    });

    await new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`Remotion exited with code ${code}`));
      });
    });

    onProgress(100, "Hoàn tất Remotion");
    return `/api/stream/videos/video_${jobId}_remotion.mp4`;
  } catch (err) {
    throw new Error(`Lỗi Remotion: ${err instanceof Error ? err.message : String(err)}`);
  }
}
