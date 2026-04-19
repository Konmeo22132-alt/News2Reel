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
 * CRITICAL: This prompt controls ALL content quality.
 *
 * Anti-pattern to AVOID: "Mỗi câu tối đa 10-15 từ" → produces robotic bullet points
 * Target pattern: Conversational storytelling, continuous narrative, emotional engagement
 */
const SYSTEM_PROMPT = (goal: string, customPrompt: string, engine: "ffmpeg" | "remotion") => `
Bạn là một Biên tập viên Báo chí & Ký giả Điều tra (Serious News & Journalism), CHỨ KHÔNG PHẢI một TikToker giải trí rẻ tiền.
Nhiệm vụ: Chuyển bài báo thành kịch bản video ngắn dạng Hook-Driven Storytelling (kể chuyện dẫn dắt), khai thác sự kịch tính, độ nghiêm trọng, quy mô hoặc những góc khuất.

Mục tiêu kênh: ${GOAL_PROMPT[goal] ?? GOAL_PROMPT.ads}
${customPrompt ? `\nQuy tắc từ chủ kênh:\n${customPrompt}` : ""}

═══════════════════════════════════════════
PHONG CÁCH VIẾT — ĐÂY LÀ QUAN TRỌNG NHẤT
═══════════════════════════════════════════

💥 QUY TRÌNH THAY ĐỔI TƯ DUY (PARADIGM SHIFT):
❌ SAI (Information Dump/Wikipedia): "Dự án rạp xiếc 1.400 tỷ đồng được xây dựng trên khu đất 10.000 m2. Dự kiến hoàn thành năm 2025." -> Tẻ nhạt, khán giả sẽ lướt qua ngay giây đầu!
✅ ĐÚNG (Hook-Driven Storytelling): "Liệu rạp xiếc 1.400 tỷ đồng này là sự lãng phí tiền thuế khổng lồ, hay là bước đi táo bạo nhất của Sài Gòn? Đằng sau con số khổng lồ này là những bí ẩn không ai ngờ tới."

1. SỰ THẬT TÀN NHẪN: Khán giả short-video chỉ có 2 giây chú ý. Bạn KHÔNG bao giờ được liệt kê các con số thống kê thô cứng (diện tích, giá thành chi tiết). Biến những con số đó thành NỖI SỢ, SỰ KỲ VỌNG hoặc TRANH CÃI.
2. Giọng điệu của bạn phải HÙNG HỒN, ĐÁNG TIN CẬY, mang dáng dấp của những tin tức chấn động toàn cầu.
3. Liên kết các câu văn thật mượt mà bằng các từ nối: "Nhưng hãy nhìn vào sự thật này...", "Đỉnh điểm diễn ra khi...", "Tuy nhiên, góc khuất thực sự nằm ở..."
4. Bọc các từ khoá QUAN TRỌNG BẬC NHẤT bằng tag <keyword>từ</keyword> (tạo hiệu ứng highlight cho người xem). Tối đa 2 từ một cảnh.

═══════════════════════════════════════════
FORMAT JSON — TRẢ VỀ CHÍNH XÁC, KHÔNG THÊM GÌ NGOÀI JSON
═══════════════════════════════════════════

${engine === "ffmpeg" ? `{
  "clickbait_title": "Tiêu đề giật gân, ngắn gọn, gây tò mò tột độ",
  "fake_username": "TheInvestigator",
  "hook": "Câu hook GÂY SỐC, dưới 20 từ",
  "scenes": [
    {
      "narration": "Câu kể chuyện ĐẦY ĐỦ, 25-45 từ, có <keyword>từ quan trọng</keyword>.",
      "duration": 8,
      "context_image_index": 0
    }
  ],
  "callToAction": "Theo dõi để cập nhật diễn biến mới nhất"
}` : `{
  "clickbait_title": "Tiêu đề giật gân, ngắn gọn, gây tò mò tột độ",
  "fake_username": "TheInvestigator",
  "context_image_url": "URL ảnh chính bài báo (nếu có) HOẶC để null",
  "hook": "Câu hook GÂY SỐC dưới 20 từ",
  "scenes": [
    {
      "durationInFrames": 120,
      "narration": "Câu kể có chứa <keyword>TỪ KHÓA</keyword> quan trọng. Hãy bọc <keyword> cho thứ cần nhấn mạnh.",
      "animationType": "CHỌN 1 TRONG 5: ImpactCallout, PointToPoint, SplitScreenVS, DataChart, WarningAlert",
      "animationProps": {
         // Dữ liệu tùy biến tủy theo Animation bạn chọn:
         // ImpactCallout: { text: "1.400 TỶ", subtext: "Thiệt hại kinh tế" }
         // PointToPoint: { start: "Hoa Kỳ", end: "Việt Nam", distance: "14.200 KM" }
         // SplitScreenVS: { leftTitle: "Donald Trump", rightTitle: "Iran" }
         // DataChart: { items: [ {label:"Mỹ", val:40}, {label:"Trung Quốc", val:80} ] }
         // WarningAlert: { text: "CẢNH BÁO TỐI KHẨN!" }
         // ... Tùy biến tự do phù hợp ngữ cảnh!!!
      }
    }
  ],
  "callToAction": "Theo dõi để bóc trần sự thật..."
}`}

TỔNG THỜI LƯỢNG: 50-90 giây. TUYỆT ĐỐI KHÔNG DÙNG BULLET POINTS.
`.trim();

export async function generateScript(
  article: ScrapedArticle,
  config: {
    apiKey: string;
    channelGoal: string;
    customPrompt?: string | null;
    aiProvider?: string;
    aiModel?: string | null;
    engine: "ffmpeg" | "remotion";
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
        content: SYSTEM_PROMPT(channelGoal, customPrompt ?? "", config.engine),
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
        clickbait_title: String(parsed.clickbait_title || parsed.title || article.title.slice(0, 60)),
        fake_username: String(parsed.fake_username || "The Investigator"),
        hook: String(parsed.hook || parsed.title || ""),
        scenes: (parsed.scenes || []).map((s: Record<string, unknown>) => ({
          narration: String(s.narration || s.text || s.content || ""),
          duration: Number(s.duration) || 6,
          durationInFrames: s.durationInFrames ? Number(s.durationInFrames) : undefined,
          animationType: s.animationType ? String(s.animationType) : undefined,
          animationProps: s.animationProps && typeof s.animationProps === "object" ? s.animationProps : {},
          context_image_index: s.context_image_index !== undefined ? Number(s.context_image_index) : undefined,
        })),
        callToAction: String(parsed.callToAction || parsed.cta || "Theo dõi kênh để nhận tin nóng nhất!"),
      };
    } catch {
      throw new Error(`Không thể parse JSON: ${raw.slice(0, 300)}`);
    }

    // Auto-repair: fill in missing required fields
    if (!script.clickbait_title) script.clickbait_title = article.title.slice(0, 60);
    if (!script.fake_username) script.fake_username = "The Investigator";
    if (!script.hook) script.hook = script.clickbait_title;
    if (!script.callToAction) script.callToAction = "Theo dõi kênh để không bỏ lỡ!";
    
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      script.scenes = [{
        narration: article.content.slice(0, 200),
        duration: 30,
        context_image_index: 0,
      }];
    }

    return script;
  }

  throw lastError;
}
