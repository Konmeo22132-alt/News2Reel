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
  // FontSize giảm từ 110 xuống 88 — subtitle 4 chữ ờt chỗ hơn
  const assStyle = isHook
    ? { ...DEFAULT_ASS_STYLE, fontSize: 88, primaryColor: ASS_COLORS.yellow }
    : isCTA
      ? { ...DEFAULT_ASS_STYLE, fontSize: 72, primaryColor: ASS_COLORS.green }
      : { ...DEFAULT_ASS_STYLE, fontSize: 82 };

  const assContent = generateWordByWordASS(narration, audioDuration, assStyle);
  await saveASSFile(assContent, assPath);

  // ── Build filter_complex ──
  let filterComplex = "";

  const brollPath = path.join(BROLL_DIR, "serious_loop.mp4");
  const hasBroll = fs.existsSync(brollPath);
  const hasArticleImage = !!(opts.articleImagePath && fs.existsSync(opts.articleImagePath));

  // ── Layer 1: Background Loop or Gradient ──
  let afterBgLabel = "bg";
  if (hasBroll) {
    // setpts=PTS-STARTPTS: reset timestamps after -stream_loop để tránh giật khi loop
    filterComplex += `[BROLL_INPUT_MARKER]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20,fps=30[bg_raw]; `;
    filterComplex += `color=c=black@0.65:s=${width}x${height}:r=30:d=${videoDuration}[dark_dim]; `;
    filterComplex += `[bg_raw][dark_dim]overlay=format=auto:shortest=1[bg]; `;
  } else {
    const gradFilter = generateAnimatedGradientFilter(width, height, theme.from, theme.to, videoDuration);
    filterComplex += `[0:v]${gradFilter}[bg]; `;
  }

  // ── Layer 1.5: Article Image with Ken Burns (crop to 9:16) ──
  // Scale image to fill 1080x1920, then apply slow zoompan for Ken Burns effect
  let afterImgLabel = afterBgLabel;
  if (hasArticleImage) {
    // Step 1: Scale to fill 1080 wide, crop to 1920 tall (9:16 fill)
    filterComplex += `[IMG_INPUT_MARKER]scale=${width}:-1,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2[img_crop]; `;
    // Step 2: Ken Burns — slow zoom from 1.0 to 1.08 over duration
    const zoomRate = (0.08 / (videoDuration * 30)).toFixed(6); // zoom step per frame
    filterComplex += `[img_crop]zoompan=z='min(zoom+${zoomRate},1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(videoDuration * 30)}:s=${width}x${height}:fps=30[img_kb]; `;
    // Step 3: Dark overlay for readability
    filterComplex += `color=c=black@0.45:s=${width}x${height}:r=30:d=${videoDuration}[img_dark]; `;
    filterComplex += `[img_kb][img_dark]overlay=format=auto[img_ov]; `;
    // Step 4: Overlay on background
    filterComplex += `[${afterBgLabel}][img_ov]overlay=0:0[bg_with_img]; `;
    afterImgLabel = "bg_with_img";
  }

  afterBgLabel = afterImgLabel;

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

  // ── Layer 3: ASS subtitle karaoke ──
  const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\''");
  filterComplex += `[${beforeAssLabel}]ass='${assEscaped}'[with_sub]; `;

  // ── Layer 4: Watermark (channel name top-left) ──
  const fontFile = fs.existsSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    ? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    : (fs.existsSync("C:/Windows/Fonts/arialbd.ttf") ? "C\\:/Windows/Fonts/arialbd.ttf" : "");
  const fontFileOpt = fontFile ? `:fontfile='${fontFile}'` : "";
  filterComplex += `[with_sub]drawtext=text='\u0040News2Reel':x=28:y=28:fontsize=32:fontcolor=0xFFFFFF@0.55:shadowcolor=0x000000@0.8:shadowx=2:shadowy=2${fontFileOpt}[watermarked]; `;

  // ── Layer 5: Breaking News lower-third (Hook scenes only) ──
  // Hiển thị "BREAKING" tag + title dưới cùng TopZone trong 1.8 giây đầu
  if (isHook && title) {
    const safeTitle = title
      .replace(/'/g, "\u2019")  // smart quote
      .replace(/:/g, "\\:")     // escape colon for drawtext
      .replace(/\\\\/g, "\\\\\\\\") // double-escape backslash
      .slice(0, 55);             // cap length
    // Red box ("BREAKING" tag)
    filterComplex += `[watermarked]drawbox=x=24:y=30:w=220:h=56:color=0xE53935@0.95:t=fill[wm_box]; `;
    filterComplex += `[wm_box]drawtext=text='BREAKING':x=34:y=46:fontsize=28:fontcolor=white:fontweight=bold${fontFileOpt}[wm_brk]; `;
    // Title text below the box — fade out after 2.5s
    filterComplex += `[wm_brk]drawtext=text='${safeTitle}':x=24:y=104:fontsize=38:fontcolor=white:shadowcolor=black@0.9:shadowx=2:shadowy=2:alpha='if(lt(t,2.5),1,max(0,1-(t-2.5)/0.5))'${fontFileOpt}[out]`;
  } else {
    filterComplex += `[watermarked]copy[out]`;
  }

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

    if (hasArticleImage) {
      cmd.input(opts.articleImagePath!);
      filterComplex = filterComplex.replace(/\[IMG_INPUT_MARKER\]/g, `[${currentInputIdx}:v]`);
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

    // BGM volume: -18dB relative to TTS voice (approx weight 0.12)
    // amix with voice at full volume, BGM at 0.12 weight
    const audioMixMap = bgmPath
      ? ["-filter_complex", `[${audioInputIdx}:a]volume=1.0[voice];[${currentInputIdx - 1}:a]volume=0.12[bgm];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
         "-map", "[out]", "-map", "[aout]"]
      : ["-map", "[out]", "-map", `${audioInputIdx}:a`];

    // Note: if bgmPath present, audio is handled by filter_complex above,
    // so we do NOT use separate -map for individual audio streams.
    const finalOutputOpts = bgmPath ? [
      "-map", "[out]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-avoid_negative_ts", "make_zero",
      `-metadata`, `title=${title}`,
    ] : [
      "-map", "[out]",
      "-map", `${audioInputIdx}:a`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", crf,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-avoid_negative_ts", "make_zero",
      `-metadata`, `title=${title}`,
    ];

    cmd.outputOptions(finalOutputOpts);

    cmd.output(outputPath);
    cmd.on("end", () => resolve());
    cmd.on("error", (err: Error) => reject(new Error(`FFmpeg scene ${sceneIndex}: ${err.message}`)));
    cmd.run();
  });
}

// ─── Concatenation with Cross-Dissolve Transitions ───────────────────────────

/**
 * Concat scenes with a 0.3s cross-dissolve transition between each pair.
 *
 * Strategy (FFmpeg xfade):
 *   - Simple copy concat for 1 scene (no transition needed)
 *   - For N scenes: chain xfade filters: [0][1]xfade → [t01], [t01][2]xfade → [t012], ...
 *   - Transition duration: XFADE_DURATION seconds (short = less jarring, avoids resampling issues)
 *   - Audio: amix at transition points (crude but works without re-encode)
 *
 * Note: xfade requires re-encode (cannot use -c copy), but produces smooth transitions.
 */
const XFADE_DURATION = 0.25; // seconds of dissolve overlap

async function concatSegments(
  ffmpeg: FfmpegStatic,
  segmentPaths: string[],
  outputPath: string,
  segmentDurations: number[] = []
): Promise<void> {
  // Single scene: just copy
  if (segmentPaths.length === 1) {
    const listPath = outputPath + ".concat.txt";
    fs.writeFileSync(listPath, `file '${segmentPaths[0].replace(/\\/g, "/")}'`, "utf-8");
    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy", "-movflags", "+faststart"])
        .output(outputPath)
        .on("end", () => { try { fs.unlinkSync(listPath); } catch {} resolve(); })
        .on("error", (err: Error) => { try { fs.unlinkSync(listPath); } catch {} reject(new Error(`FFmpeg concat: ${err.message}`)); })
        .run();
    });
  }

  // Multi-scene: xfade transition chain
  // Build filter_complex:
  //   Each scene is input [0:v], [1:v], [2:v], ...
  //   [0:v][1:v]xfade=transition=fade:duration=0.25:offset=<d0-0.25>[t01]
  //   [t01][2:v]xfade=transition=fade:duration=0.25:offset=<cumulative>[t012]
  //   ...
  // Audio: amix all audio streams together (simple approach)

  const cmd = ffmpeg();
  for (const p of segmentPaths) {
    cmd.input(p);
  }

  let filterParts: string[] = [];
  let prevLabel = "0:v";
  let timeOffset = 0;

  for (let i = 1; i < segmentPaths.length; i++) {
    const dur = segmentDurations[i - 1] ?? 8;
    timeOffset += dur - XFADE_DURATION;
    const outLabel = i === segmentPaths.length - 1 ? "vout" : `t${i}`;
    const inLabel = i === 1 ? "0:v" : `t${i - 1}`;
    filterParts.push(
      `[${inLabel}][${i}:v]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${timeOffset.toFixed(3)}[${outLabel}]`
    );
    prevLabel = outLabel;
  }

  // Audio: amix all inputs
  const audioInputs = segmentPaths.map((_, i) => `[${i}:a]`).join("");
  filterParts.push(`${audioInputs}amix=inputs=${segmentPaths.length}:duration=first:dropout_transition=1[aout]`);

  const filterStr = filterParts.join("; ");

  return new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter(filterStr)
      .outputOptions([
        "-map", `[${prevLabel}]`,
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => {
        // Fallback: plain concat without transitions if xfade fails
        console.warn(`[FFmpeg] xfade failed (${err.message}), falling back to plain concat`);
        const listPath = outputPath + ".concat.txt";
        const content = segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
        fs.writeFileSync(listPath, content, "utf-8");
        ffmpeg()
          .input(listPath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .outputOptions(["-c", "copy"])
          .output(outputPath)
          .on("end", () => { try { fs.unlinkSync(listPath); } catch {} resolve(); })
          .on("error", (e2: Error) => reject(new Error(`FFmpeg concat: ${e2.message}`)))
          .run();
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
  const segmentDurations: number[] = []; // Track per-scene duration for xfade offset calc


  const allScenes = [
    { narration: script.hook, isHook: true, isCTA: false, context_image_url: undefined as string | undefined },
    ...script.scenes.map((s) => ({
      narration: s.narration,
      isHook: false,
      isCTA: false,
      context_image_url: s.context_image_url,
    })),
    { narration: script.callToAction, isHook: false, isCTA: true, context_image_url: undefined as string | undefined },
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
      segmentDurations.push(duration + 0.5); // match videoDuration in renderScene

      const renderPercent = Math.round(((i * 2 + 1) / (totalSteps * 2)) * 100);
      onProgress?.(renderPercent, `Render cảnh ${i + 1}/${allScenes.length}`);

      let articleImagePath: string | null = null;
      if (downloadedImages.length > 0) {
        // Ưu tiên URL ảnh do AI chọn cho scene này (nếu có trong downloadedImages)
        const aiUrl = scene.context_image_url;
        if (aiUrl && articleImageUrls) {
          const urlIdx = articleImageUrls.indexOf(aiUrl);
          if (urlIdx >= 0 && urlIdx < downloadedImages.length) {
            articleImagePath = downloadedImages[urlIdx] ?? null;
          }
        }
        // Fallback: round-robin
        if (!articleImagePath) {
          const imgIdx = (scene.isHook || scene.isCTA) ? 0 : i % downloadedImages.length;
          articleImagePath = downloadedImages[imgIdx] ?? null;
        }
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
    await concatSegments(ffmpeg, segmentPaths, outputPath, segmentDurations);


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
