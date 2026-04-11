/**
 * TTS Module — Vietnamese text-to-speech using Google Translate TTS.
 * Free, no API key required. Max ~200 chars per chunk.
 *
 * If this gets rate-limited, swap out synthesizeChunk() for any other provider
 * (OpenAI TTS, Azure, Zalo AI TTS, etc.) without changing the rest of the pipeline.
 */

import fs from "fs";
import path from "path";
import os from "os";

const GTTS_URL = "https://translate.google.com/translate_tts";
const MAX_CHUNK_CHARS = 180;

/** Split text at sentence/clause boundaries so each chunk ≤ MAX_CHUNK_CHARS */
function splitText(text: string): string[] {
  const chunks: string[] = [];
  // Split at Vietnamese sentence-ending punctuation
  const sentences = text.split(/(?<=[.!?,;:])\s+/u);

  let buffer = "";
  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK_CHARS) {
      // Sentence itself too long — split at word boundaries
      if (buffer) { chunks.push(buffer.trim()); buffer = ""; }
      const words = sentence.split(" ");
      let sub = "";
      for (const w of words) {
        if ((sub + " " + w).length > MAX_CHUNK_CHARS) {
          if (sub) chunks.push(sub.trim());
          sub = w;
        } else {
          sub += (sub ? " " : "") + w;
        }
      }
      if (sub) buffer = sub;
    } else if ((buffer + " " + sentence).length > MAX_CHUNK_CHARS) {
      if (buffer) chunks.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer += (buffer ? " " : "") + sentence;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.filter(Boolean);
}

/** Synthesize one chunk of text → MP3 buffer */
async function synthesizeChunk(text: string): Promise<Buffer> {
  const url = new URL(GTTS_URL);
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("q", text);
  url.searchParams.set("tl", "vi");       // Vietnamese
  url.searchParams.set("client", "tw-ob");
  url.searchParams.set("ttspeed", "0.85"); // Slightly slower for clarity

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Referer: "https://translate.google.com/",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`TTS HTTP ${res.status} for text: "${text.slice(0, 50)}..."`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Convert full narration text to an MP3 file.
 * Returns the path to the temp MP3 file.
 * Caller is responsible for deleting it after use.
 */
export async function textToSpeech(text: string, outputPath: string): Promise<void> {
  const chunks = splitText(text);
  if (chunks.length === 0) throw new Error("Empty text for TTS");

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    // Small delay between chunks to avoid rate limiting
    if (buffers.length > 0) await new Promise((r) => setTimeout(r, 300));
    const buf = await synthesizeChunk(chunk);
    buffers.push(buf);
  }

  // Concatenate all MP3 chunks into one file
  // Note: Direct MP3 concatenation works because MP3 is a streaming format
  const combined = Buffer.concat(buffers);
  fs.writeFileSync(outputPath, combined);
}

/**
 * Get audio duration in seconds by reading MP3 header.
 * Uses ffprobe for accurate measurement.
 */
export async function getAudioDuration(mp3Path: string): Promise<number> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");

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
