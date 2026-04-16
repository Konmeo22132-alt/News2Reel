/**
 * AI Script Generator — calls an OpenAI-compatible API
 * to turn a scraped article into a structured TikTok video script.
 *
 * Supported providers (set via .env on VPS):
 *   - Beeknoee: platform.beeknoee.com  (default)
 *   - Groq:     api.groq.com/openai/v1  (faster, generous free tier)
 *   - DeepSeek: api.deepseek.com
 *
 * Env vars (optional overrides, set in /var/www/News2Reel/.env):
 *   AI_BASE_URL=https://api.groq.com/openai/v1
 *   AI_MODEL=llama-3.3-70b-versatile
 */

import type { ScrapedArticle, VideoScript } from "./types";

const BEEKNOEE_API_URL = "https://platform.beeknoee.com/api/v1/chat/completions";

// Allow overriding provider via env vars (useful for switching to Groq/DeepSeek)
const API_BASE = process.env.AI_BASE_URL ?? BEEKNOEE_API_URL.replace("/chat/completions", "");
const API_URL = `${API_BASE}/chat/completions`;
const MODEL = process.env.AI_MODEL ?? "openai/gpt-oss-120b";

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
  config: { apiKey: string; channelGoal: string; customPrompt?: string | null }
): Promise<VideoScript> {
  const { apiKey, channelGoal, customPrompt } = config;

  const body = JSON.stringify({
    model: MODEL,
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
    max_tokens: 1500,
    response_format: { type: "json_object" },
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
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(90_000),
      });
      console.log(`[AI] Provider: ${API_URL} | Model: ${MODEL}`);
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

    if (!raw) throw new Error("Beeknoee API trả về kết quả rỗng");

    let script: VideoScript;
    try {
      // Strip markdown code fences if model wraps JSON in ```json...```
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      script = JSON.parse(cleaned);
    } catch {
      throw new Error(`Không thể parse JSON từ Beeknoee: ${raw.slice(0, 200)}`);
    }

    // Validate structure
    if (!script.title || !script.hook || !Array.isArray(script.scenes)) {
      throw new Error("Cấu trúc kịch bản không hợp lệ");
    }

    return script;
  }

  throw lastError;
}
