/**
 * Video Renderer — generates a real 9:16 MP4 video from a VideoScript.
 *
 * Pipeline per scene:
 *   1. TTS → MP3 file (Vietnamese narration)
 *   2. ffprobe → measure MP3 duration
 *   3. FFmpeg: color input (duration = MP3 duration) + drawtext filters + audio mux
 *   4. Concatenate all scenes into final video
 */

import path from "path";
import fs from "fs";
import os from "os";
import type Ffmpeg from "fluent-ffmpeg";
import type { VideoScript } from "./types";
import { textToSpeech, getAudioDuration, tempMp3Path } from "./tts";

type FfmpegStatic = typeof Ffmpeg;

const OUTPUT_DIR = path.join(process.cwd(), "public", "videos");

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

const BG_COLORS = ["0f0f1a", "111827", "1a1033", "0d1117", "1e1b4b", "12121f"];
const ACCENT_COLORS = ["6366f1", "8b5cf6", "a855f7", "7c3aed", "4f46e5", "818cf8"];

/** Escape text for FFmpeg drawtext filter */
function ffEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%");
}

/** Wrap at ~28 Vietnamese chars per line */
function wrapText(text: string, max = 28): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur += (cur ? " " : "") + w;
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.join("\n");
}

/** Render a single scene segment with audio */
async function renderScene(opts: {
  ffmpeg: FfmpegStatic;
  index: number;
  total: number;
  narration: string;
  audioPath: string;
  audioDuration: number;
  isHook: boolean;
  isCTA: boolean;
  bgColor: string;
  accentColor: string;
  title: string;
  quality: string;
  outputPath: string;
  width: number;
  height: number;
}): Promise<void> {
  const {
    ffmpeg, index, total, narration, audioPath, audioDuration,
    isHook, isCTA, bgColor, accentColor, title, quality, outputPath, width, height,
  } = opts;

  const fontSize = isHook ? 70 : 56;
  const textColor = isHook ? `0x${accentColor}` : "0xf0efff";
  const wrappedText = ffEscape(wrapText(narration));
  const safeTitle = ffEscape(title.slice(0, 38));

  // Add a small buffer to avoid audio cut-off
  const videoDuration = audioDuration + 0.3;

  const drawFilters = [
    // Top accent bar
    `drawbox=x=0:y=0:w=${width}:h=10:color=0x${accentColor}@0.9:t=fill`,
    // Bottom accent bar
    `drawbox=x=0:y=${height - 10}:w=${width}:h=10:color=0x${accentColor}@0.9:t=fill`,
    // Scene counter (not on hook/CTA)
    ...(isHook || isCTA
      ? []
      : [`drawtext=text='${index}/${total - 2}':fontsize=30:fontcolor=0xffffff@0.4:x=(w-tw)/2:y=90`]),
    // Main narration text — centered
    `drawtext=text='${wrappedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-tw)/2:y=(h-th)/2:line_spacing=20:font=Sans`,
    // Title at bottom
    `drawtext=text='${safeTitle}':fontsize=26:fontcolor=0xffffff@0.45:x=(w-tw)/2:y=${height - 80}`,
  ];

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      // Video: solid color background
      .input(`color=0x${bgColor}:s=${width}x${height}:r=30`)
      .inputOptions(["-f", "lavfi"])
      .duration(videoDuration)
      // Audio: TTS MP3
      .input(audioPath)
      .videoFilters(drawFilters)
      .outputOptions([
        "-map", "0:v",
        "-map", "1:a",
        "-c:v", "libx264",
        "-preset", "fast",
        quality === "1080p" ? "-crf 18" : "-crf 23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",           // Stop when shortest stream (audio) ends
        "-avoid_negative_ts", "make_zero",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(new Error(`FFmpeg scene ${index}: ${err.message}`)))
      .run();
  });
}

/** Concatenate MP4 segments (with audio) into final video */
async function concatSegments(
  ffmpeg: FfmpegStatic,
  segmentPaths: string[],
  outputPath: string
): Promise<void> {
  // Write concat list
  const listPath = outputPath + ".concat.txt";
  const listContent = segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  fs.writeFileSync(listPath, listContent);

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
        fs.unlinkSync(listPath);
        resolve();
      })
      .on("error", (err: Error) => {
        try { fs.unlinkSync(listPath); } catch { /* ignore */ }
        reject(new Error(`FFmpeg concat: ${err.message}`));
      })
      .run();
  });
}

export async function renderVideo(
  script: VideoScript,
  quality: string,
  jobId: string
): Promise<string> {
  ensureOutputDir();

  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { default: ffmpegPath } = await import("ffmpeg-static");
  
  // Ưu tiên dùng ffmpeg của Linux VPS (thường hỗ trợ đầy đủ lavfi filter)
  if (fs.existsSync("/usr/bin/ffmpeg")) {
    ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
  } else if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  const width = 1080;
  const height = 1920;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "avideo-"));
  const segmentPaths: string[] = [];
  const mp3Paths: string[] = [];

  const allScenes = [
    { narration: script.hook, isHook: true, isCTA: false },
    ...script.scenes.map((s) => ({ narration: s.narration, isHook: false, isCTA: false })),
    { narration: script.callToAction, isHook: false, isCTA: true },
  ];

  try {
    for (let i = 0; i < allScenes.length; i++) {
      const scene = allScenes[i];
      const bgColor = BG_COLORS[i % BG_COLORS.length];
      const accentColor = ACCENT_COLORS[i % ACCENT_COLORS.length];
      const segPath = path.join(tempDir, `seg_${i}.mp4`);
      const mp3Path = tempMp3Path(`seg_${i}`);
      segmentPaths.push(segPath);
      mp3Paths.push(mp3Path);

      // Generate TTS audio for this scene
      await textToSpeech(scene.narration, mp3Path);
      const duration = await getAudioDuration(mp3Path);

      // Render scene video + audio
      await renderScene({
        ffmpeg,
        index: i,
        total: allScenes.length,
        narration: scene.narration,
        audioPath: mp3Path,
        audioDuration: duration,
        isHook: scene.isHook,
        isCTA: scene.isCTA,
        bgColor,
        accentColor,
        title: script.title,
        quality,
        outputPath: segPath,
        width,
        height,
      });
    }

    // Concatenate all into final video
    const outputFileName = `video_${jobId}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    await concatSegments(ffmpeg, segmentPaths, outputPath);

    return `/videos/${outputFileName}`;
  } finally {
    // Cleanup all temp files
    for (const p of [...segmentPaths, ...mp3Paths]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
