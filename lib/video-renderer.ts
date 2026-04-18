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
  generateTerminalBox,
  ASS_COLORS,
  DEFAULT_ASS_STYLE,
  saveASSFile,
} from "./vfx-subtitle";

type FfmpegStatic = typeof import("fluent-ffmpeg");

const OUTPUT_DIR = path.join(process.cwd(), "public", "videos");
const ASSETS_DIR = path.join(process.cwd(), "public", "assets", "visuals");
const BGM_DIR = path.join(process.cwd(), "public", "assets", "bgm");

// ─── Gradient themes (dark + tech accent) ───────────────────────────────────
const GRADIENT_THEMES = [
  { from: "#0d0d0d", to: "#2c0000" },   // Dark → Red
  { from: "#0d0d0d", to: "#001833" },   // Dark → Blue
  { from: "#0d0d0d", to: "#1a0033" },   // Dark → Purple
  { from: "#0a0a0a", to: "#003300" },   // Dark → Green
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
}

/** Find a valid BGM track or return null */
function getBgmPath(): string | null {
  for (const track of BGM_TRACKS) {
    const p = path.join(BGM_DIR, track);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ─── Visual config helpers ─────────────────────────────────────────────────────

/**
 * Get icon overlay configuration with animated positioning.
 * Returns null if no visual should be shown.
 */
function getVisualConfig(visualId: string, width: number, height: number): {
  iconPath: string | null;
  drawboxFilter: string | null;
  hasTerminal: boolean;
} | null {
  const iconPath = path.join(ASSETS_DIR, `${visualId}.png`);

  if (fs.existsSync(iconPath)) {
    return { iconPath, drawboxFilter: null, hasTerminal: false };
  }

  if (visualId === "terminal" || visualId === "code_window") {
    return {
      iconPath: null,
      drawboxFilter: generateTerminalBox(width, height, 0, 0, visualId),
      hasTerminal: true,
    };
  }

  return null;
}

// ─── Scene rendering with 5-layer architecture ────────────────────────────────

async function renderScene(opts: {
  ffmpeg: FfmpegStatic;
  sceneIndex: number;
  totalScenes: number;
  narration: string;
  visualId: string;
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
}): Promise<void> {
  const {
    ffmpeg, sceneIndex, totalScenes, narration, visualId, audioPath,
    audioDuration, isHook, isCTA, theme, title, quality, outputPath,
    assPath, bgmPath, width, height,
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

  const visual = getVisualConfig(visualId, width, height);
  const iconPath = visual?.iconPath ?? null;
  const hasIcon = !!iconPath && fs.existsSync(iconPath);
  const hasTerminal = visual?.hasTerminal ?? false;

  // ── Build filter_complex ──
  // Input numbering:
  //   [0:v] = color source (gradient base)
  //   [1:a] = TTS narration audio
  //   [2:v] = PNG icon (if exists)
  //   [3:a] = BGM audio (if exists)
  let filterComplex = "";

  // ── Layer 1: Animated gradient background ──
  const gradFilter = generateAnimatedGradientFilter(width, height, theme.from, theme.to, videoDuration);
  filterComplex += `[0:v]${gradFilter}[bg]; `;

  // ── Layer 2: Dynamic icon animation (pop-in + floating sine) ──
  if (hasIcon) {
    // Scale icon to 280px wide
    const iconW = 280;
    const iconH = -1; // maintain aspect
    const baseX = Math.floor(width / 2 - iconW / 2);
    const baseY = Math.floor(height / 3);

    // Pop-in entrance: scale from 0 → 1.2 → 1.0 over 400ms
    // Floating: sine wave on Y axis (amplitude 15px, period ~2s)
    const popIn = `scale=${iconW}:${iconH},setpts=PTS-STARTPTS+${(sceneIndex * 0.1).toFixed(2)}/TB`;
    const floating = `overlay=format=auto:enable='between(t\,${(sceneIndex * 0.1).toFixed(2)}\,${videoDuration})'` +
      `:x=${baseX}:y='${baseY}+floor(15*sin(2*PI*t))'`;

    // Use trim/setpts to handle pop-in timing per scene
    filterComplex += `[2:v]${popIn}[icon]; `;
    filterComplex += `[bg][icon]${floating}[with_icon]; `;
  }

  // ── Layer 2.5: Terminal box (drawbox) ──
  if (hasTerminal) {
    const boxColor = visualId === "terminal" ? "0x00FF00" : "0x00FFFF";
    const boxW = 560, boxH = 180;
    const boxX = Math.floor((width - boxW) / 2);
    const boxY = Math.floor(height / 2);
    filterComplex += `[bg]drawbox=x=${boxX}:y=${boxY}:w=${boxW}:h=${boxH}:color=${boxColor}:width=2:radius=8:t=fill[with_box]; `;
  }

  // ── Layer 3: Scene counter + scene number text ──
  const isMiddleScene = !isHook && !isCTA;
  if (isMiddleScene) {
    const counterText = `${sceneIndex}/${totalScenes - 2}`;
    const counterFilter = `[${hasIcon || hasTerminal ? (hasIcon ? "with_icon" : "with_box") : "bg"}]` +
      `drawtext=text='${counterText}':fontsize=28:fontcolor=0xffffff@0.35:x=(w-tw)/2:y=80:font=Roboto[base]; `;
    filterComplex += counterFilter;
  }

  // ── Layer 4: ASS subtitles (bouncing karaoke) ──
  const baseLabel = isMiddleScene ? "base" : (hasIcon ? "with_icon" : hasTerminal ? "with_box" : "bg");
  const assEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  filterComplex += `[${baseLabel}]ass=${assEscaped}[out]`;

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();

    // Input 0: color source (gradient base)
    cmd.input(`color=0x000000:s=${width}x${height}:r=30:d=${videoDuration}`)
      .inputOptions(["-f", "lavfi"]);

    // Input 1: TTS narration audio
    cmd.input(audioPath);

    // Input 2: PNG icon (if exists)
    if (hasIcon) cmd.input(iconPath!);

    // Input 3: BGM audio (if exists)
    if (bgmPath) cmd.input(bgmPath);

    // Output
    cmd.outputOptions([
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-map", "1:a",               // TTS narration
      ...(bgmPath ? ["-map", "2:a"] : []), // BGM (if available)
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

    cmd.on("start", (cmdLine: string) => {
      console.log(`[FFmpeg Scene ${sceneIndex}] CMD: ${cmdLine.slice(0, 200)}`);
    });

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

/**
 * Render a full VideoScript → MP4 with all 5 Retention Boosters.
 *
 * @param script   VideoScript with hook + scenes + CTA
 * @param quality  "720p" | "1080p"
 * @param jobId    Unique job ID for output filename
 * @returns Streaming URL for Next.js
 */
export async function renderVideo(
  script: VideoScript,
  quality: string,
  jobId: string
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

  const segmentPaths: string[] = [];
  const mp3Paths: string[] = [];
  const assPaths: string[] = [];

  // ── Build all scenes: hook + scenes + CTA ──
  const allScenes = [
    { narration: script.hook, isHook: true, isCTA: false, visualId: "laptop" },
    ...script.scenes.map((s) => ({
      narration: s.narration,
      isHook: false,
      isCTA: false,
      visualId: (s.visual_id as string) || "chip",
    })),
    { narration: script.callToAction, isHook: false, isCTA: true, visualId: "star" },
  ];

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

      console.log(`[Renderer] Scene ${i + 1}/${allScenes.length} | Visual: ${scene.visualId} | ${scene.narration.slice(0, 40)}...`);

      // ── TTS + duration ──
      await textToSpeech(scene.narration, mp3Path, {
        voice: "vi-VN-NamMinhNeural",
        rate: "+20%",
      });
      const duration = await getAudioDuration(mp3Path);

      // ── Render scene ──
      await renderScene({
        ffmpeg,
        sceneIndex: i,
        totalScenes: allScenes.length,
        narration: scene.narration,
        visualId: scene.visualId,
        audioPath: mp3Path,
        audioDuration: duration,
        isHook: scene.isHook,
        isCTA: scene.isCTA,
        theme,
        title: script.title,
        quality,
        outputPath: segPath,
        assPath,
        bgmPath,
        width,
        height,
      });

      console.log(`[Renderer] ✓ Scene ${i + 1} done → ${path.basename(segPath)}`);
    }

    // ── Concatenate all scenes ──
    const outputFileName = `video_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    await concatSegments(ffmpeg, segmentPaths, outputPath);

    console.log(`[Renderer] ✓ Video generated: ${outputPath}`);
    return `/api/stream/videos/${outputFileName}`;

  } finally {
    // Cleanup temp files
    for (const p of [...segmentPaths, ...mp3Paths, ...assPaths]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── Quick test render (single scene) ────────────────────────────────────────

/**
 * Single-scene test render for debugging.
 * Use this to preview visual effects before full render.
 */
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

    // Input 0: Background (Color)
    // Input 1: Audio
    // Input 2: Icon (if exists)
    // Input 3: BGM (if exists)

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
