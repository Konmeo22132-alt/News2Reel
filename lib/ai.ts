/**
 * AI Script Generator — calls Beeknoee API (OpenAI-compatible)
 * to turn a scraped article into a structured TikTok video script.
 *
 * Provider: platform.beeknoee.com
 * Model: openai/gpt-oss-120b
 */

import type { ScrapedArticle, VideoScript } from "./types";

const BEEKNOEE_API_URL = "https://platform.beeknoee.com/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

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

  const response = await fetch(BEEKNOEE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
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
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Beeknoee API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const raw = json?.choices?.[0]?.message?.content;

  if (!raw) throw new Error("Beeknoee API trả về kết quả rỗng");

  let script: VideoScript;
  try {
    // Strip markdown code fences if model ignores response_format and wraps JSON in ```json...```
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
