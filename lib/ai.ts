/**
 * AI Script Generator — calls an OpenAI-compatible API
 * to turn a scraped article into a structured TikTok video script.
 * 
 * Features:
 * - Tech-style narration with <keyword> tags for highlighting
 * - Visual IDs for matching scene visuals
 * - Fast-paced, engaging content optimized for TikTok
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

// Allow env var overrides
const ENV_BASE = process.env.AI_BASE_URL;
const ENV_MODEL = process.env.AI_MODEL;

// Visual IDs for FFmpeg layer
export const VISUAL_IDS = [
  "laptop", "rocket", "skull", "warning", "code_window",
  "terminal", "robot", "chip", "globe", "lock",
  "chart", "dollar", "fire", "star", "lightning",
] as const;

export type VisualID = typeof VISUAL_IDS[number];

// Goal prompts
const GOAL_PROMPT: Record<string, string> = {
  ads: `Tạo nội dung giật tít, hook mạnh trong 3 giây đầu, tối ưu watch time và retention rate. Sử dụng ngôn ngữ gây tò mò, shock value phù hợp.`,
  affiliate: `Tạo nội dung nổi bật tính năng/lợi ích sản phẩm, cài Call-to-Action rõ ràng như "Link in bio", "Mua ngay", "Xem chi tiết". Thúc đẩy hành động mua hàng.`,
  branding: `Tạo nội dung chuyên nghiệp, cung cấp giá trị thực sự. Xây dựng uy tín và hình ảnh chuyên gia. Tông giọng tự tin, đáng tin cậy.`,
};

/**
 * Tech-style system prompt for TikTok Tech Reviewer
 * Creates fast-paced, engaging scripts with keyword highlighting
 */
const SYSTEM_PROMPT = (goal: string, customPrompt: string) => `
Bạn là một TikTok Tech Reviewer chuyên nghiệp. Hãy tạo kịch bản video ngắn (45-90 giây) từ bài viết được cung cấp.

Mục tiêu kênh: ${GOAL_PROMPT[goal] ?? GOAL_PROMPT.ads}
${customPrompt ? `\nQuy tắc bổ sung từ chủ kênh:\n${customPrompt}` : ""}

NGUYÊN TẮC VIẾT KỊCH BẢN:
1. Viết CỰC KỲ SÚC TÍCH - mỗi câu tối đa 10-15 từ tiếng Việt
2. Câu văn phải bị CHẶT NHỎ làm nhiều CẢNH (scenes), mỗi cảnh 5-10 giây
3. BỌC các TỪ KHOÁ quan trọng bằng thẻ <keyword>Từ Khoá</keyword>
4. Mỗi scene TRẢ VỀ 1 visual_id ngẫu nhiên từ danh sách: ${VISUAL_IDS.join(", ")}

TRẢ VỀ JSON với cấu trúc CHÍNH XÁC sau (không thêm text ngoài JSON):
{
  "title": "Tiêu đề video ngắn gọn, gây tò mò (tối đa 60 ký tự)",
  "hook": "Câu hook cực mạnh trong 3 giây đầu (tối đa 15 từ)",
  "scenes": [
    {
      "narration": "Nội dung cảnh 1 ngắn gọn, bọc <keyword>từ quan trọng</keyword> trong thẻ keyword",
      "duration": 6,
      "visual_id": "laptop"
    },
    {
      "narration": "Nội dung cảnh 2 ngắn gọn, bọc <keyword>từ quan trọng</keyword> trong thẻ keyword",
      "duration": 6,
      "visual_id": "code_window"
    }
  ],
  "callToAction": "Lời kêu gọi hành động cuối video (tối đa 20 từ)"
}

QUY TẮC QUAN TRỌNG:
- Tổng thời lượng scenes phải từ 45-90 giây
- VIẾT BẰNG TIẾNG VIỆT TỰ NHIÊN, DỄ HIỂU
- Ngôn ngữ súc tích, KHÔNG RƯỜM RA
- Hook phải GÂY CHÁN ÊM, buộc người xem phải xem tiếp
- Không bọc tất cả từ trong keyword, CHỈ NHỮNG từ thật sự QUAN TRỌNG hoặc buzzwords
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
    temperature: 0.8,
    max_tokens: 8000,
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
      lastError = new Error(`Rate limited (429). Thử lại sau ít phút.`);
      continue; // retry
    }

    if (!response.ok) {
      const errText = await response.text().then((t) => t.slice(0, 500)).catch(() => "");
      throw new Error(`AI API error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content;

    if (!raw) {
      console.log(`[AI] Response JSON keys: ${Object.keys(json ?? {}).join(", ")}`);
      throw new Error("AI API trả về kết quả rỗng");
    }
    console.log(`[AI] Raw response (first 300): ${raw.slice(0, 300)}`);

    let script: VideoScript;
    try {
      // Strip markdown code fences
      const cleaned = raw
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/```\s*$/m, "")
        .trim();
      // Handle cases where model returns partial JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      
      // Normalize to VideoScript format
      script = {
        title: parsed.title || article.title.slice(0, 60),
        hook: parsed.hook || parsed.title || "",
        scenes: (parsed.scenes || []).map((s: Record<string, unknown>) => ({
          narration: s.narration || s.text || s.content || "",
          duration: Number(s.duration) || 6,
          visual_id: s.visual_id || VISUAL_IDS[Math.floor(Math.random() * VISUAL_IDS.length)],
        })),
        callToAction: parsed.callToAction || parsed.cta || "Theo dõi kênh để không bỏ lỡ!",
      };
    } catch {
      throw new Error(`Không thể parse JSON: ${raw.slice(0, 300)}`);
    }

    // Auto-repair: fill in missing required fields
    if (!script.title) script.title = article.title.slice(0, 60);
    if (!script.hook) script.hook = script.title;
    if (!script.callToAction) script.callToAction = "Theo dõi kênh để không bỏ lỡ!";
    
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      script.scenes = [{
        narration: article.content.slice(0, 200),
        duration: 30,
        visual_id: "laptop",
      }];
    }

    return script;
  }

  throw lastError;
}
