/**
 * HyperFrames Video Renderer — Engine 3
 * ======================================
 * Renders video scenes using HyperFrames (HTML + GSAP → headless Chrome → FFmpeg MP4).
 *
 * Pipeline per scene:
 *   1. Parse narration → word timing array
 *   2. Inject vars into scene-base.html template
 *   3. Write temp HTML file to .tmp/hf/scene-N.html
 *   4. Call `npx hyperframes render --input scene.html --output scene.mp4 --fps 30`
 *   5. After all scenes, mux audio with each scene video (FFmpeg)
 *   6. Concat scene mp4s → final output
 *
 * HyperFrames handles:
 *   - Ken Burns animation (GSAP translateX + scale)
 *   - 4-word karaoke highlight (GSAP class toggle)
 *   - Breaking news banner (GSAP slide-in)
 *   - ImpactCallout / DataChart / SplitScreenVS / WarningAlert overlays
 *
 * FFmpeg handles (after HF render):
 *   - Audio mux (TTS voice)
 *   - BGM mix at -18dB
 *   - Concat all scenes
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { VideoScript, ScriptScene, AppConfig } from "./types";

const TEMPLATE_PATH = path.join(process.cwd(), "lib", "hyperframes-templates", "scene-base.html");
const TMP_DIR = path.join(process.cwd(), ".tmp", "hf");
const OUTPUT_DIR = path.join(process.cwd(), "public", "videos");
const BGM_DIR = path.join(process.cwd(), "public", "assets", "bgm");

// ─── Types ────────────────────────────────────────────────────────────────────

interface WordTiming {
  text: string;
  isKeyword: boolean;
  startSec: number;
  endSec: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Parse narration text (with <keyword> tags) into word timing array.
 * Distributes timings evenly based on audio duration.
 */
function buildWordTimings(narration: string, audioDuration: number): WordTiming[] {
  const words: WordTiming[] = [];
  const parts = narration.split(/(<keyword>.*?<\/keyword>)/gi);

  let allWords: { text: string; isKeyword: boolean }[] = [];
  for (const part of parts) {
    if (part.toLowerCase().startsWith("<keyword>")) {
      const inner = part.replace(/<\/?keyword>/gi, "");
      inner.split(/\s+/).filter(Boolean).forEach((w) => allWords.push({ text: w, isKeyword: true }));
    } else {
      part.split(/\s+/).filter(Boolean).forEach((w) => allWords.push({ text: w, isKeyword: false }));
    }
  }

  const secPerWord = audioDuration / Math.max(allWords.length, 1);
  allWords.forEach((w, i) => {
    words.push({
      text: w.text,
      isKeyword: w.isKeyword,
      startSec: parseFloat((i * secPerWord).toFixed(3)),
      endSec:   parseFloat(((i + 1) * secPerWord).toFixed(3)),
    });
  });

  return words;
}

/**
 * Inject variable values into the HTML template.
 * Uses data-variable-values attribute on <body> since we control the template.
 */
function buildSceneHTML(
  templateHTML: string,
  vars: Record<string, string>
): string {
  const varJson = JSON.stringify(vars).replace(/"/g, "&quot;");
  // Inject data-variable-values on the body tag
  return templateHTML.replace(
    /<body>/,
    `<body id="root" data-composition-id="news2reel-scene" data-width="1080" data-height="1920" data-variable-values="${varJson}">`
  );
}

/**
 * Render a single scene HTML via HyperFrames CLI.
 * Returns path to rendered MP4 (video-only, no audio yet).
 */
function renderSceneHTML(
  htmlPath: string,
  outputPath: string,
  durationSec: number,
  fps = 30
): void {
  // HyperFrames CLI command
  // --duration: total seconds to render
  // --width/--height: output resolution
  const cmd = [
    "npx", "hyperframes", "render",
    `--input "${htmlPath}"`,
    `--output "${outputPath}"`,
    `--width 1080`,
    `--height 1920`,
    `--fps ${fps}`,
    `--duration ${durationSec.toFixed(3)}`,
  ].join(" ");

  console.log(`[HyperFrames] Rendering scene: ${path.basename(htmlPath)}`);
  console.log(`[HyperFrames] CMD: ${cmd}`);

  try {
    execSync(cmd, {
      stdio: "pipe",
      timeout: 300_000, // 5 min max per scene
      env: { ...process.env, PUPPETEER_PRODUCT: "chrome" },
    });
    console.log(`[HyperFrames] ✅ Rendered: ${path.basename(outputPath)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`HyperFrames render failed for ${path.basename(htmlPath)}: ${msg}`);
  }
}

/**
 * Mux video-only MP4 from HyperFrames with TTS audio using FFmpeg.
 */
function muxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  bgmPath?: string | null
): void {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

  let audioFilter: string;
  let audioMap: string;

  if (bgmPath && fs.existsSync(bgmPath)) {
    // Mix TTS voice (full volume) + BGM (0.12 = ~-18dB)
    audioFilter = `-filter_complex "[1:a]volume=1.0[voice];[2:a]volume=0.12[bgm];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]"`;
    audioMap = "";
  } else {
    audioFilter = `-map 0:v -map 1:a`;
    audioMap = "";
  }

  const bgmInput = bgmPath && fs.existsSync(bgmPath) ? `-i "${bgmPath}"` : "";
  const cmd = `${ffmpeg} -y -i "${videoPath}" -i "${audioPath}" ${bgmInput} ${audioFilter} -c:v copy -c:a aac -b:a 128k -shortest "${outputPath}" 2>&1`;

  console.log(`[HyperFrames/FFmpeg] Muxing audio: ${path.basename(outputPath)}`);
  try {
    execSync(cmd, { stdio: "pipe", timeout: 120_000 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`FFmpeg mux failed: ${msg}`);
  }
}

/**
 * Concat multiple scene MP4s into a single output file.
 * Uses FFmpeg concat demuxer (no re-encode).
 */
function concatScenes(scenePaths: string[], outputPath: string): void {
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";

  const listFile = path.join(TMP_DIR, `concat-${Date.now()}.txt`);
  const content  = scenePaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(listFile, content, "utf8");

  const cmd = `${ffmpeg} -y -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}" 2>&1`;
  console.log(`[HyperFrames/FFmpeg] Concatenating ${scenePaths.length} scenes → ${path.basename(outputPath)}`);

  try {
    execSync(cmd, { stdio: "pipe", timeout: 120_000 });
    fs.unlinkSync(listFile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`FFmpeg concat failed: ${msg}`);
  }
}

// ─── Main Render Function ─────────────────────────────────────────────────────

export interface HyperFramesRenderOptions {
  script: VideoScript;
  jobId: string;
  config: AppConfig;
  /** Resolved audio paths per scene, e.g. /path/to/scene-0.mp3 */
  audioPaths: string[];
  /** Duration per scene in seconds (measured from actual TTS audio) */
  audioDurations: number[];
}

export async function renderVideoHyperFrames(opts: HyperFramesRenderOptions): Promise<string> {
  const { script, jobId, config, audioPaths, audioDurations } = opts;

  ensureDir(TMP_DIR);
  ensureDir(OUTPUT_DIR);

  const templateHTML = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const finalOutput  = path.join(OUTPUT_DIR, `video_${jobId}.mp4`);

  // Find BGM
  const bgmFiles  = fs.existsSync(BGM_DIR) ? fs.readdirSync(BGM_DIR).filter((f) => f.endsWith(".mp3") || f.endsWith(".mp4")) : [];
  const bgmPath   = bgmFiles.length > 0 ? path.join(BGM_DIR, bgmFiles[0]) : null;

  const muxedScenePaths: string[] = [];

  for (let i = 0; i < script.scenes.length; i++) {
    const scene: ScriptScene       = script.scenes[i];
    const audioPath: string | undefined = audioPaths[i];
    const audioDuration: number     = audioDurations[i] ?? 8;

    if (!audioPath || !fs.existsSync(audioPath)) {
      console.warn(`[HyperFrames] Scene ${i}: no audio, skipping`);
      continue;
    }

    // Build word timings
    const words = buildWordTimings(scene.narration, audioDuration);

    // Build vars for template
    const s = scene as any;
    const animData = scene.animationProps ? JSON.stringify(scene.animationProps) : "{}";
    const vars: Record<string, string> = {
      title:         script.clickbait_title   || "",
      narration:     scene.narration          || "",
      imageUrl:      s.imageUrl || scene.context_image_url || script.context_image_url || "",
      username:      script.fake_username     || "News2Reel",
      animationType: scene.animationType      || "",
      animationData: animData,
      isHook:        (s.isHook ?? false) ? "true" : "false",
      sceneDuration: audioDuration.toFixed(3),
      audioUrl:      "",   // Audio muxed separately after render
      words:         JSON.stringify(words),
    };

    // Write scene HTML
    const sceneHTML    = buildSceneHTML(templateHTML, vars);
    const htmlPath     = path.join(TMP_DIR, `scene-${jobId}-${i}.html`);
    const videoNoAudio = path.join(TMP_DIR, `scene-${jobId}-${i}-noaudio.mp4`);
    const videoMuxed   = path.join(TMP_DIR, `scene-${jobId}-${i}-muxed.mp4`);

    fs.writeFileSync(htmlPath, sceneHTML, "utf8");

    // Render via HyperFrames
    renderSceneHTML(htmlPath, videoNoAudio, audioDuration);

    // Mux audio
    muxAudio(videoNoAudio, audioPath, videoMuxed, bgmPath);

    muxedScenePaths.push(videoMuxed);

    // Cleanup temp HTML + noaudio
    try { fs.unlinkSync(htmlPath); fs.unlinkSync(videoNoAudio); } catch {}
  }

  if (muxedScenePaths.length === 0) {
    throw new Error("[HyperFrames] No scenes were rendered successfully.");
  }

  // Concat all muxed scenes
  if (muxedScenePaths.length === 1) {
    fs.copyFileSync(muxedScenePaths[0], finalOutput);
  } else {
    concatScenes(muxedScenePaths, finalOutput);
  }

  // Cleanup muxed temp files
  muxedScenePaths.forEach((p) => { try { fs.unlinkSync(p); } catch {} });

  console.log(`[HyperFrames] 🎉 Final video: ${finalOutput}`);
  return finalOutput;
}
