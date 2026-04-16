/**
 * TTS Module — Vietnamese text-to-speech using Microsoft Edge TTS.
 * High quality, natural voice with adjustable speed (+20% faster).
 * 
 * Voices available:
 *   vi-VN-NamMinhNeural  - Male, deep, tech MC style
 *   vi-VN-HoaiMyNeural   - Female, fast, energetic
 * 
 * Install: npm install edge-tts
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// Default voice settings
const DEFAULT_VOICE = "vi-VN-NamMinhNeural";
const DEFAULT_RATE = "+20%";  // 20% faster for engaging content
const DEFAULT_PITCH = "+0Hz";

export interface TTSOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
}

/**
 * Convert Vietnamese text to MP3 using edge-tts CLI.
 * Falls back to Google Translate TTS if edge-tts is not available.
 * 
 * @param text - Text to synthesize (max ~500 chars for best quality)
 * @param outputPath - Path to save MP3 file
 * @param options - Voice options (voice, rate, pitch)
 */
export async function textToSpeech(
  text: string,
  outputPath: string,
  options: TTSOptions = {}
): Promise<void> {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || DEFAULT_RATE;
  const pitch = options.pitch || DEFAULT_PITCH;

  // Try edge-tts first (higher quality)
  try {
    await synthesizeWithEdgeTTS(text, outputPath, voice, rate, pitch);
    console.log(`[TTS] Generated with Edge TTS: ${voice} @ ${rate}`);
    return;
  } catch (edgeError) {
    console.warn(`[TTS] Edge TTS failed, trying Google TTS: ${edgeError}`);
  }

  // Fallback to Google Translate TTS
  await synthesizeWithGoogleTTS(text, outputPath);
}

/**
 * Synthesize using edge-tts CLI (requires Python + edge-tts package)
 */
async function synthesizeWithEdgeTTS(
  text: string,
  outputPath: string,
  voice: string,
  rate: string,
  pitch: string
): Promise<void> {
  // Escape quotes in text for shell command
  const escapedText = text.replace(/"/g, '\\"');
  
  const cmd = `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text="${escapedText}" --write-media="${outputPath}"`;
  
  try {
    execSync(cmd, { encoding: "utf-8", timeout: 30000 });
    if (!fs.existsSync(outputPath)) {
      throw new Error("Edge TTS did not create output file");
    }
  } catch (error) {
    // Check if edge-tts is installed
    try {
      execSync("edge-tts --version", { encoding: "utf-8", timeout: 5000 });
    } catch {
      throw new Error(
        "edge-tts not installed. Install with: pip install edge-tts"
      );
    }
    throw error;
  }
}

/**
 * Fallback: Google Translate TTS (lower quality but always available)
 */
async function synthesizeWithGoogleTTS(text: string, outputPath: string): Promise<void> {
  const GTTS_URL = "https://translate.google.com/translate_tts";
  const MAX_CHUNK = 180;

  // Split text into chunks
  const chunks = splitText(text, MAX_CHUNK);
  const buffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    const url = new URL(GTTS_URL);
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("q", chunk);
    url.searchParams.set("tl", "vi");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("ttspeed", "1.2"); // Faster speed

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`TTS HTTP ${res.status} for: "${chunk.slice(0, 30)}..."`);
    }

    buffers.push(Buffer.from(await res.arrayBuffer()));

    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const combined = Buffer.concat(buffers);
  fs.writeFileSync(outputPath, combined);
}

/** Split text at sentence/clause boundaries */
function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?,;:])[\s\n]*/u);

  let buffer = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (buffer) { chunks.push(buffer.trim()); buffer = ""; }
      const words = sentence.split(" ");
      let sub = "";
      for (const w of words) {
        if ((sub + " " + w).length > maxChars) {
          if (sub) chunks.push(sub.trim());
          sub = w;
        } else {
          sub += (sub ? " " : "") + w;
        }
      }
      if (sub) buffer = sub;
    } else if ((buffer + " " + sentence).length > maxChars) {
      if (buffer) chunks.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer += (buffer ? " " : "") + sentence;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.filter(Boolean);
}

/**
 * Get audio duration in seconds using ffprobe.
 */
export async function getAudioDuration(mp3Path: string): Promise<number> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { default: ffmpegBinPath } = await import("ffmpeg-static");

  if (ffmpegBinPath) {
    const ffprobePath = ffmpegBinPath.replace(
      /[/\\]ffmpeg(\.exe)?$/i,
      (_, ext: string | undefined) => `${path.sep}ffprobe${ext ?? ""}`
    );
    if (fs.existsSync(ffprobePath)) {
      ffmpeg.setFfprobePath(ffprobePath);
    }
  }

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(mp3Path, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration ?? 5);
    });
  });
}

/** Create a temp path for an MP3 file */
export function tempMp3Path(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}_${Date.now()}.mp3`);
}

/**
 * Check if edge-tts is available on the system.
 * Returns true if Python + edge-tts is installed.
 */
export function isEdgeTTSAvailable(): boolean {
  try {
    execSync("edge-tts --version", { encoding: "utf-8", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of available Vietnamese voices.
 */
export function getVietnameseVoices(): { name: string; gender: string }[] {
  return [
    { name: "vi-VN-NamMinhNeural", gender: "male" },
    { name: "vi-VN-HoaiMyNeural", gender: "female" },
    { name: "vi-VN-AnNeural", gender: "male" },
    { name: "vi-VN-MinhanhNeural", gender: "female" },
  ];
}