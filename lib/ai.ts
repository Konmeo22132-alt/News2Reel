/**
 * AI Script Generator — calls DeepSeek API (OpenAI-compatible)
 * to turn a scraped article into a structured TikTok video script.
 */

import type { ScrapedArticle, VideoScript } from "./types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";

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
  config: { deepseekApiKey: string; channelGoal: string; customPrompt?: string | null }
): Promise<VideoScript> {
  const { deepseekApiKey, channelGoal, customPrompt } = config;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepseekApiKey}`,
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
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const raw = json?.choices?.[0]?.message?.content;

  if (!raw) throw new Error("DeepSeek trả về kết quả rỗng");

  let script: VideoScript;
  try {
    script = JSON.parse(raw);
  } catch {
    throw new Error(`Không thể parse JSON từ DeepSeek: ${raw.slice(0, 200)}`);
  }

  // Validate structure
  if (!script.title || !script.hook || !Array.isArray(script.scenes)) {
    throw new Error("Cấu trúc kịch bản không hợp lệ");
  }

  return script;
}
