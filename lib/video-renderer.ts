/**
 * Video Renderer — TikTok-style MP4 generator with Retention Boosters.
 *
 * 5-Layer Architecture:
 *   Layer 1: Animated Gradient Background (shifting colors via geq + halclut)
 *   Layer 2: Dynamic Icon Animation (pop-in entrance + floating sine wave)
 *   Layer 3: Bouncing Karaoke Subtitles (120%→100% scale per word)
 *   Layer 4: Visual FX (glow, neon highlight on keywords)
 *   Layer 5: BGM/SFX Audio Layer (epic background music + transition SFX)
 *
 * Pipeline per scene:
 *   1. TTS → MP3 (Edge TTS +20% speed)
 *   2. ffprobe → measure MP3 duration
 *   3. Generate ASS with bouncing karaoke effect per word
 *   4. FFmpeg: animated gradient + dynamic icon overlay + ASS + audio mux
 *   5. Concatenate all scenes → final video
 *
 * Retention Boosters:
 *   ✓ Bouncing Karaoke Text (scale 120%→100% per word, red/yellow highlight)
 *   ✓ Dynamic Icon Overlay (pop-in + floating sine wave)
 *   ✓ Animated Gradient Background (shifting radial gradient)
 *   ✓ BGM/SFX Layer (epic bgm + pop SFX on scene transition)
 */

import path from "path";
import fs from "fs";
import type { VideoScript } from "./types";
import { textToSpeech, getAudioDuration, tempMp3Path } from "./tts";
import {
  generateWordByWordASS,
  generateAnimatedGradientFilter,
  ASS_COLORS,
  DEFAULT_ASS_STYLE,
  saveASSFile,
} from "./vfx-subtitle";
import { screenshotBatch } from "./playwright-screenshot";

type FfmpegStatic = typeof import("fluent-ffmpeg");

const OUTPUT_DIR = path.join(process.cwd(), "public", "videos");
const ASSETS_DIR = path.join(process.cwd(), "public", "assets", "visuals");
const BGM_DIR = path.join(process.cwd(), "public", "assets", "bgm");

const BROLL_DIR = path.join(process.cwd(), "public", "assets", "broll");

// ─── Gradient themes (Elegant, serious, professional) ──────────────────────
const GRADIENT_THEMES = [
  { from: "#0f172a", to: "#020617" },   // Deep Slate → Almost Black
  { from: "#171717", to: "#0a0a0a" },   // Charcoal → Deep Void
  { from: "#1e1e2f", to: "#050510" },   // Midnight Blue → Abyss
];

// ─── BGM catalog (royalty-free style tracks) ─────────────────────────────────
const BGM_TRACKS = [
  "sigma-epic.mp3",
  "synthwave-chill.mp3",
  "tech-future.mp3",
  "dramatic-pulse.mp3",
];

function ensureOutputDirs(): void {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  if (!fs.existsSync(BGM_DIR)) fs.mkdirSync(BGM_DIR, { recursive: true });
  if (!fs.existsSync(BROLL_DIR)) fs.mkdirSync(BROLL_DIR, { recursive: true });
}

/** Find a valid BGM track or return null */
function getBgmPath(): string | null {
  for (const track of BGM_TRACKS) {
    const p = path.join(BGM_DIR, track);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Download an image URL to a local temp path.
 * Returns the local path on success, null on failure.
 * Supports jpg/png/webp. Skips download if already cached.
 */
async function downloadArticleImage(url: string, destPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AutoVideo/1.0)",
        "Referer": new URL(url).origin,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 5000) return null; // too small = icon/tracker
    fs.writeFileSync(destPath, buffer);
    console.log(`[Image] Downloaded ${buffer.length} bytes → ${path.basename(destPath)}`);
    return destPath;
  } catch (e) {
    console.warn(`[Image] Failed to download ${url}: ${e}`);
    return null;
  }
}

// ─── Scene rendering with 3-layer architecture ────────────────────────────────

async function renderScene(opts: {
  ffmpeg: FfmpegStatic;
  sceneIndex: number;
  totalScenes: number;
  narration: string;
  audioPath: string;
  audioDuration: number;
  isHook: boolean;
  isCTA: boolean;
  theme: { from: string; to: string };
  title: string;
  quality: string;
  outputPath: string;
  assPath: string;
  bgmPath: string | null;
  width: number;
  height: number;
  articleImagePath?: string | null; // downloaded article image for this scene
  socialImagePath?: string | null;  // Playwright screenshot of social card UI
}): Promise<void> {
  const {
    ffmpeg, sceneIndex, totalScenes, narration, audioPath,
    audioDuration, isHook, isCTA, theme, title, quality, outputPath,
    assPath, bgmPath, width, height, socialImagePath
  } = opts;

  const videoDuration = audioDuration + 0.5;
  const crf = quality === "1080p" ? "17" : "20";

  // ── Style: hook=yellow+large, cta=green, normal=white ──
  const assStyle = isHook
    ? { ...DEFAULT_ASS_STYLE, fontSize: 120, primaryColor: ASS_COLORS.yellow }
    : isCTA
    ? { ...DEFAULT_ASS_STYLE, fontSize: 90, primaryColor: ASS_COLORS.green }
    : DEFAULT_ASS_STYLE;

  const assContent = generateWordByWordASS(narration, audioDuration, assStyle);
  await saveASSFile(assContent, assPath);

  // ── Build filter_complex ──
  let filterComplex = "";

  const brollPath = path.join(BROLL_DIR, "serious_loop.mp4");
  const hasBroll = fs.existsSync(brollPath);

  // ── Layer 1: Background Loop or Gradient ──
  let afterBgLabel = "bg";
  if (hasBroll) {
    // We expect the broll to be mapped dynamically below as [BROLL_INPUT_MARKER]
    // Crop it to 1080x1920 center and apply a heavy boxblur
    filterComplex += `[BROLL_INPUT_MARKER]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20[bg_raw]; `;
    // Overlay a dark overlay to make it moody and professional
    filterComplex += `color=c=black@0.65:s=${width}x${height}:r=30:d=${videoDuration}[dark_dim]; `;
    filterComplex += `[bg_raw][dark_dim]overlay=format=auto[bg]; `;
  } else {
    const gradFilter = generateAnimatedGradientFilter(width, height, theme.from, theme.to, videoDuration);
    filterComplex += `[0:v]${gradFilter}[bg]; `;
  }

  // ── Layer 2: Social UI Overlay ──
  const hasSocialImage = !!(socialImagePath && fs.existsSync(socialImagePath));
  let beforeAssLabel = afterBgLabel;

  if (hasSocialImage) {
    const cardScale = `1040:-1`;
    filterComplex += `[SOCIAL_INPUT_MARKER]scale=${cardScale},format=rgba[social_raw]; `;
    const startY = height;
    const endY = `(H-h)/2 - 50`;
    const durIn = 1.0;
    const yExpr = `if(lt(t,${durIn}), ${startY}, ${endY} + (${startY}-${endY})*(1-min(t/${durIn},1)))`;
    filterComplex += `[social_raw]fade=t=in:st=0:d=${durIn}:alpha=1[social_faded]; `;
    filterComplex += `[${beforeAssLabel}][social_faded]overlay=x=(W-w)/2:y='${yExpr}':eval=frame[with_social]; `;
    beforeAssLabel = "with_social";
  }

  // ── Layer 4: ASS subtitle karaoke ──
  const baseLabel = beforeAssLabel;
  const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\''");

  filterComplex += `[${baseLabel}]ass='${assEscaped}'[out]`;

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();
    let currentInputIdx = 0;

    cmd.input(`color=0x000000:s=${width}x${height}:r=30:d=${videoDuration}`).inputOptions(["-f", "lavfi"]);
    currentInputIdx++;

    const audioInputIdx = currentInputIdx;
    cmd.input(audioPath);
    currentInputIdx++;

    if (hasBroll) {
      cmd.input(brollPath).inputOptions(["-stream_loop", "-1"]);
      filterComplex = filterComplex.replace(/\[BROLL_INPUT_MARKER\]/g, `[${currentInputIdx}:v]`);
      currentInputIdx++;
    }

    if (hasSocialImage) {
      cmd.input(socialImagePath!);
      filterComplex = filterComplex.replace(/\[SOCIAL_INPUT_MARKER\]/g, `[${currentInputIdx}:v]`);
      currentInputIdx++;
    }

    if (bgmPath) {
      cmd.input(bgmPath);
      currentInputIdx++;
    }

    cmd.complexFilter(filterComplex);

    cmd.outputOptions([
      "-map", "[out]",
      "-map", `${audioInputIdx}:a`,
      ...(bgmPath ? ["-map", `${currentInputIdx - 1}:a`] : []),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-avoid_negative_ts", "make_zero",
      `-metadata`, `title=${title}`,
      `-metadata`, `comment=Generated by AutoVideo TikTok Engine v2.0`,
    ]);

    cmd.output(outputPath);
    cmd.on("end", () => resolve());
    cmd.on("error", (err: Error) => reject(new Error(`FFmpeg scene ${sceneIndex}: ${err.message}`)));
    cmd.run();
  });
}

// ─── Concatenation ────────────────────────────────────────────────────────────

async function concatSegments(
  ffmpeg: FfmpegStatic,
  segmentPaths: string[],
  outputPath: string
): Promise<void> {
  const listPath = outputPath + ".concat.txt";
  const listContent = segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(listPath, listContent, "utf-8");

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions([
        "-c", "copy",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        try { fs.unlinkSync(listPath); } catch { /* ignore */ }
        resolve();
      })
      .on("error", (err: Error) => {
        try { fs.unlinkSync(listPath); } catch { /* ignore */ }
        reject(new Error(`FFmpeg concat: ${err.message}`));
      })
      .run();
  });
}

// ─── Main render function ─────────────────────────────────────────────────────

export async function renderVideo(
  script: VideoScript,
  quality: string,
  jobId: string,
  onProgress?: (percent: number, step: string) => void,
  articleImageUrls?: string[],
  socialCards?: { twitterCardHtml: string; commentsCardHtml: string }
): Promise<string> {
  ensureOutputDirs();

  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { default: ffmpegPath } = await import("ffmpeg-static");

  if (fs.existsSync("/usr/bin/ffmpeg")) {
    ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
  } else if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  const width = 1080;
  const height = 1920;

  const localTmp = path.join(process.cwd(), ".tmp");
  if (!fs.existsSync(localTmp)) fs.mkdirSync(localTmp, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(localTmp, `av2-${jobId}-`));

  const bgmPath = getBgmPath();

  const downloadedImages: (string | null)[] = [];
  if (articleImageUrls && articleImageUrls.length > 0) {
    onProgress?.(2, `Tải ${articleImageUrls.length} ảnh từ bài báo...`);
    for (let idx = 0; idx < Math.min(articleImageUrls.length, 6); idx++) {
      const ext = articleImageUrls[idx].includes(".webp") ? ".webp" : ".jpg";
      const imgPath = path.join(tempDir, `img_${idx}${ext}`);
      const result = await downloadArticleImage(articleImageUrls[idx], imgPath);
      downloadedImages.push(result);
    }
  }

  let twitterCardPng: string | null = null;
  let commentsCardPng: string | null = null;
  if (socialCards) {
    onProgress?.(3, "Chụp ảnh UI tương tác (Social cards)...");
    const tPath = path.join(tempDir, "twitter.png");
    const cPath = path.join(tempDir, "comments.png");
    const results = await screenshotBatch([
      { html: socialCards.twitterCardHtml, outputPath: tPath, opts: { width: 1040 } },
      { html: socialCards.commentsCardHtml, outputPath: cPath, opts: { width: 1040 } }
    ]);
    twitterCardPng = results[0];
    commentsCardPng = results[1];
  }

  const segmentPaths: string[] = [];
  const mp3Paths: string[] = [];
  const assPaths: string[] = [];

  const allScenes = [
    { narration: script.hook, isHook: true, isCTA: false },
    ...script.scenes.map((s) => ({
      narration: s.narration,
      isHook: false,
      isCTA: false,
    })),
    { narration: script.callToAction, isHook: false, isCTA: true },
  ];

  const totalSteps = allScenes.length + 1;

  try {
    for (let i = 0; i < allScenes.length; i++) {
      const scene = allScenes[i];
      const theme = GRADIENT_THEMES[i % GRADIENT_THEMES.length];
      const segPath = path.join(tempDir, `seg_${String(i).padStart(3, "0")}.mp4`);
      const mp3Path = tempMp3Path(`seg_${i}`);
      const assPath = path.join(tempDir, `sub_${String(i).padStart(3, "0")}_${Date.now()}.ass`);

      segmentPaths.push(segPath);
      mp3Paths.push(mp3Path);
      assPaths.push(assPath);

      const ttsPercent = Math.round(((i * 2) / (totalSteps * 2)) * 100);
      onProgress?.(ttsPercent, `TTS cảnh ${i + 1}/${allScenes.length}`);

      let socialImagePathForScene: string | null = null;
      if (i === 0 && twitterCardPng) {
        socialImagePathForScene = twitterCardPng;
      } else if (i === allScenes.length - 1 && commentsCardPng) {
        socialImagePathForScene = commentsCardPng;
      }

      const ttsNarration = scene.narration.replace(/<\/?keyword>/gi, "");
      await textToSpeech(ttsNarration, mp3Path, { voice: "vi-VN-NamMinhNeural", rate: "+20%" });
      const duration = await getAudioDuration(mp3Path);

      const renderPercent = Math.round(((i * 2 + 1) / (totalSteps * 2)) * 100);
      onProgress?.(renderPercent, `Render cảnh ${i + 1}/${allScenes.length}`);

      let articleImagePath: string | null = null;
      if (downloadedImages.length > 0) {
        const imgIdx = scene.isHook || (scene as any).isCTA ? 0 : i % downloadedImages.length;
        articleImagePath = downloadedImages[imgIdx] ?? null;
      }

      await renderScene({
        ffmpeg,
        sceneIndex: i,
        totalScenes: allScenes.length,
        narration: scene.narration,
        audioPath: mp3Path,
        audioDuration: duration,
        isHook: scene.isHook,
        isCTA: (scene as any).isCTA,
        theme,
        title: script.clickbait_title,
        quality,
        outputPath: segPath,
        assPath,
        bgmPath,
        width,
        height,
        articleImagePath,
        socialImagePath: socialImagePathForScene,
      } as any);
    }

    onProgress?.(95, "Ghép cảnh thành video");
    const outputFileName = `video_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    await concatSegments(ffmpeg, segmentPaths, outputPath);

    onProgress?.(100, "Hoàn thành render");
    return `/api/stream/videos/${outputFileName}`;

  } finally {
    for (const p of [...segmentPaths, ...mp3Paths, ...assPaths]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── Quick test render (single scene) ────────────────────────────────────────

export async function renderTestScene(
  narration: string,
  visualId: string = "laptop",
  outputPath?: string
): Promise<string> {
  ensureOutputDirs();

  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { default: ffmpegPath } = await import("ffmpeg-static");

  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

  const width = 1080;
  const height = 1920;
  const localTmp = path.join(process.cwd(), ".tmp");
  if (!fs.existsSync(localTmp)) fs.mkdirSync(localTmp, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(localTmp, `test-`));

  const mp3Path = tempMp3Path("test");
  const assPath = path.join(tempDir, `test.ass`);
  const segPath = outputPath || path.join(OUTPUT_DIR, `test_${Date.now()}.mp4`);
  const bgmPath = getBgmPath();

  try {
    await textToSpeech(narration, mp3Path, { voice: "vi-VN-NamMinhNeural", rate: "+20%" });
    const duration = await getAudioDuration(mp3Path);

    const assContent = generateWordByWordASS(narration, duration, DEFAULT_ASS_STYLE);
    await saveASSFile(assContent, assPath);

    const iconPath = path.join(ASSETS_DIR, `${visualId}.png`);
    const hasIcon = fs.existsSync(iconPath);

    const escapedAssPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    let filterComplex = `[0:v]geq=r='15+15*sin(T)':g='10+5*sin(T)':b='15+10*sin(T)',vignette=PI/4[grad]; `;

    if (hasIcon) {
      filterComplex += `[2:v]scale=300:-1[icon_scaled]; `;
      filterComplex += `[grad][icon_scaled]overlay=x='(W-w)/2':y='H/3+30*sin(t*3)':eval=frame[with_icon]; `;
      filterComplex += `[with_icon]ass=${escapedAssPath}[out]`;
    } else {
      filterComplex += `[grad]ass=${escapedAssPath}[out]`;
    }

    return new Promise<string>((resolve, reject) => {
      const cmd = ffmpeg();

      cmd.input(`color=0x000000:s=${width}x${height}:r=30:d=${duration + 0.5}`)
        .inputOptions(["-f", "lavfi"]);
      cmd.input(mp3Path);

      if (hasIcon) cmd.input(iconPath);
      if (bgmPath) cmd.input(bgmPath);

      cmd.outputOptions([
        "-filter_complex", filterComplex,
        "-map", "[out]",
        "-map", "1:a",
        ...(bgmPath ? ["-map", "2:a"] : []),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-avoid_negative_ts", "make_zero",
      ]);

      cmd.output(segPath);

      cmd.on("start", (cmdLine: string) => {
        console.log("[Test Render] FFmpeg: " + cmdLine.slice(0, 300));
      });

      cmd.on("end", () => resolve(segPath));
      cmd.on("error", (err: Error) => reject(err));

      cmd.run();
    });
  } finally {
    try { if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path); } catch { /* ignore */ }
    try { if (fs.existsSync(assPath)) fs.unlinkSync(assPath); } catch { /* ignore */ }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
