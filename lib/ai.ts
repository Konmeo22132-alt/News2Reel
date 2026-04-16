/**
 * AI Script Generator — calls an OpenAI-compatible API
 * to turn a scraped article into a structured TikTok video script.
 *
 * Supported providers:
 *   - beeknoee: platform.beeknoee.com (default)
 *   - groq:     api.groq.com/openai/v1 (fast, generous free tier)
 */

import type { ScrapedArticle, VideoScript } from "./types";

const PROVIDER_URLS: Record<string, string> = {
  beeknoee: "https://platform.beeknoee.com/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

const DEFAULT_MODELS: Record<string, string> = {
  beeknoee: "openai/gpt-oss-120b",
  groq: "llama-3.3-70b-versatile",
};

// Allow env var overrides (useful for quick switching without redeploy)
const ENV_BASE = process.env.AI_BASE_URL;
const ENV_MODEL = process.env.AI_MODEL;

const GOAL_PROMPT: Record<string, string> = {
  ads: `Tạo nội dung giật tít, hook mạnh trong 3 giây đầu, tối ưu watch time và retention rate. Sử dụng ngôn ngữ gây tò mò, shock value phù hợp.`,
  affiliate: `Tạo nội dung nổi bật tính năng/lợi ích sản phẩm, cài Call-to-Action rõ ràng như "Link in bio", "Mua ngay", "Xem chi tiết". Thúc đẩy hành động mua hàng.`,
  branding: `Tạo nội dung chuyên nghiệp, cung cấp giá trị thực sự. Xây dựng uy tín và hình ảnh chuyên gia. Tông giọng tự tin, đáng tin cậy.`,
};

const SYSTEM_PROMPT = (goal: string, customPrompt: string) => `
Bạn là một chuyên gia sản xuất nội dung TikTok người Việt. Hãy tạo kịch bản video ngắn (60-90 giây) từ bài viết tin tức được cung cấp.

Mục tiêu kênh: ${GOAL_PROMPT[goal] ?? GOAL_PROMPT.ads}
${customPrompt ? `\nQuy tắc bổ sung từ chủ kênh:\n${customPrompt}` : ""}

Trả về JSON với cấu trúc CHÍNH XÁC sau (không thêm text ngoài JSON):
{
  "title": "Tiêu đề video ngắn gọn",
  "hook": "Câu hook kéo scroll trong 3 giây đầu (tối đa 15 từ)",
  "scenes": [
    {"narration": "Nội dung cảnh 1 (40-60 từ)", "duration": 10},
    {"narration": "Nội dung cảnh 2 (40-60 từ)", "duration": 10},
    {"narration": "Nội dung cảnh 3 (40-60 từ)", "duration": 10},
    {"narration": "Nội dung cảnh 4 (40-60 từ)", "duration": 10},
    {"narration": "Nội dung cảnh 5 (40-60 từ)", "duration": 10}
  ],
  "callToAction": "Lời kêu gọi hành động cuối video"
}
Tổng thời lượng các scenes phải từ 45-90 giây. Viết bằng tiếng Việt tự nhiên, dễ hiểu.
`.trim();

export async function generateScript(
  article: ScrapedArticle,
  config: {
    apiKey: string;
    channelGoal: string;
    customPrompt?: string | null;
    aiProvider?: string;
    aiModel?: string | null;
  }
): Promise<VideoScript> {
  const { apiKey, channelGoal, customPrompt } = config;
  const provider = config.aiProvider ?? "beeknoee";
  const apiUrl = ENV_BASE ? `${ENV_BASE}/chat/completions`
    : (PROVIDER_URLS[provider] ?? PROVIDER_URLS.beeknoee);
  const model = ENV_MODEL ?? config.aiModel ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.beeknoee;

  console.log(`[AI] Provider: ${provider} | Model: ${model} | URL: ${apiUrl}`);

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT(channelGoal, customPrompt ?? ""),
      },
      {
        role: "user",
        content: `Bài viết:\nTiêu đề: ${article.title}\n\nNội dung:\n${article.content}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 8000,
    // Note: response_format removed — not supported by all providers/models
  });

  // Retry up to 3 times on 429 (rate limit)
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      const wait = attempt * 10_000; // 10s, 20s back-off
      console.log(`[AI] Rate limited, retry ${attempt}/3 sau ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(90_000),
      });
    } catch (fetchErr) {
      lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      console.error(`[AI] Fetch attempt ${attempt} failed:`, lastError.message);
      continue;
    }

    if (response.status === 429) {
      lastError = new Error(`Beeknoee rate limited (429). Thử lại sau ít phút.`);
      continue; // retry
    }

    if (!response.ok) {
      // Read only first 500 chars of error to avoid body-read timeout
      const errText = await response.text().then((t) => t.slice(0, 500)).catch(() => "");
      throw new Error(`Beeknoee API error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content;

    // Log raw to help debug malformed responses
    if (!raw) {
      console.log(`[AI] Response JSON keys: ${Object.keys(json ?? {}).join(", ")}`);
      console.log(`[AI] choices: ${JSON.stringify(json?.choices?.slice(0, 1))}`);
      throw new Error("AI API trả về kết quả rỗng");
    }
    console.log(`[AI] Raw response (first 200): ${raw.slice(0, 200)}`);

    let script: VideoScript;
    try {
      // Strip markdown code fences
      const cleaned = raw
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/```\s*$/m, "")
        .trim();
      // Handle cases where model returns partial JSON or wraps in extra text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      script = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      throw new Error(`Không thể parse JSON: ${raw.slice(0, 300)}`);
    }

    // Auto-repair: fill in missing required fields with sensible defaults
    if (!script.title)     script.title = article.title.slice(0, 80);
    if (!script.hook)      script.hook  = script.title;
    if (!script.callToAction) script.callToAction = "Theo dõi kênh để không bỏ lỡ!";
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      // Try to build scenes from any content field the model may have returned
      const fallback = (script as Record<string, unknown>).content
        ?? (script as Record<string, unknown>).narration
        ?? article.content.slice(0, 400);
      script.scenes = [{ narration: String(fallback).slice(0, 400), duration: 60 }];
    }

    return script;
  }

  throw lastError;
}
