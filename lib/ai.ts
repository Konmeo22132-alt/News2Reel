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
const SYSTEM_PROMPT = (goal: string, customPrompt: string) => `
Bạn là một Content Creator TikTok hàng triệu view chuyên về tin tức công nghệ, kinh tế, và thời sự.
Nhiệm vụ: Chuyển bài báo thành kịch bản video ngắn HẤP DẪN dạng storytelling, KHÔNG PHẢI tóm tắt bullet point.

Mục tiêu kênh: ${GOAL_PROMPT[goal] ?? GOAL_PROMPT.ads}
${customPrompt ? `\nQuy tắc từ chủ kênh:\n${customPrompt}` : ""}

═══════════════════════════════════════════
PHONG CÁCH VIẾT — ĐÂY LÀ QUAN TRỌNG NHẤT
═══════════════════════════════════════════

✅ ĐÚNG — Storytelling liên tục, giọng kể chuyện tự nhiên:
  "Hôm qua, một sự kiện chấn động cả thị trường dầu mỏ xảy ra khi OPEC+ bất ngờ tuyên bố..."
  "Cái tên Claude AI đang khiến cả Silicon Valley phải giật mình — và đây là lý do tại sao..."

❌ SAI — Bullet point kiểu PowerPoint, cực kỳ nhàm chán:
  "OPEC tăng sản lượng"  ← QUÁ NGẮN, VÔ HỒN
  "Giá dầu giảm mạnh"    ← KHÔNG CÓ CONTEXT
  "Thị trường phản ứng"  ← AI ĐÃ BỊ KHÁCH HÀNG PHÀ NÀN VÌ ĐIỀU NÀY

═══════════════════════════════════════════
QUY TẮC VIẾT NARRATION
═══════════════════════════════════════════

1. MỖI CẢNH phải có ít nhất 25-45 từ — đủ cho 6-10 giây audio
2. Viết như đang KỂ CHUYỆN cho bạn bè nghe — tự nhiên, có cảm xúc
3. GIỮ LIÊN KẾT giữa các cảnh — câu này phải "kéo" sang câu tiếp theo
4. Dùng các transition mạnh: "Nhưng điều đó chưa phải tệ nhất...", "Và đây là phần gây sốc nhất...", "Trong khi đó..."
5. Bọc từ khoá THỰC SỰ QUAN TRỌNG bằng <keyword>từ</keyword> — tối đa 2-3 keyword/cảnh
6. HOOK phải gây sốc/tò mò trong đúng 3 giây đầu — đây là yếu tố sống còn

═══════════════════════════════════════════
LOẠI CẢNH (scene_type) — CHỌN ĐỂ HỖ TRỢ CÂU CHUYỆN, KHÔNG THAY THẾ NÓ
═══════════════════════════════════════════

- "normal":       Cảnh kể chuyện chính — emoji icon + karaoke subtitle. Dùng nhiều nhất.
- "counter":      Khi nhắc đến CON SỐ nổi bật (%, ngày, tỷ đồng). counter_end + counter_label + counter_suffix
- "vs_screen":    Khi CÓ SỰ TƯƠNG PHẢN rõ ràng. vs_left (tên ngắn) + vs_right (tên ngắn)
- "terminal":     Khi đề cập CODE, CVE, lệnh kỹ thuật. terminal_lines (mảng lệnh, bắt đầu bằng ">")
- "checklist":    Khi liệt kê HÀNH ĐỘNG hoặc ĐIỂM CHÍNH cuối video. checklist_items (3-5 mục)
- "progress_bar": Khi có TỶ LỆ PHẦN TRĂM/thị phần. progress_target (số 0-100) + progress_label

Visual IDs: laptop, rocket, skull, warning, terminal, robot, chip, globe, lock, chart, dollar, fire, star, lightning, shield, bell, scale

═══════════════════════════════════════════
FORMAT JSON — TRẢ VỀ CHÍNH XÁC, KHÔNG THÊM GÌ NGOÀI JSON
═══════════════════════════════════════════

{
  "title": "Tiêu đề hấp dẫn, tối đa 60 ký tự",
  "hook": "Câu hook GÂY SỐC, dưới 20 từ, buộc người xem tiếp tục ngay lập tức",
  "scenes": [
    {
      "narration": "Câu kể chuyện ĐẦY ĐỦ, 25-45 từ, có <keyword>từ quan trọng</keyword> được bọc tag. Không tóm tắt, hãy KỂ CHUYỆN như đang nói chuyện hấp dẫn với bạn bè.",
      "duration": 8,
      "visual_id": "globe",
      "scene_type": "normal"
    },
    {
      "narration": "Và con số khiến tôi phải kiểm tra lại hai lần — trong vỏn vẹn 14 ngày, <keyword>22 lỗ hổng bảo mật</keyword> đã bị khai thác hoàn toàn tự động.",
      "duration": 6,
      "visual_id": "skull",
      "scene_type": "counter",
      "counter_end": 22,
      "counter_label": "lỗ hổng bị khai thác",
      "counter_suffix": ""
    },
    {
      "narration": "Con người cần nhiều tuần để phân tích cùng khối lượng mã nguồn đó. AI làm trong 48 giờ. Đây không còn là tương lai nữa — đây là hiện tại.",
      "duration": 7,
      "visual_id": "lightning",
      "scene_type": "vs_screen",
      "vs_left": "Con người",
      "vs_right": "AI Speed"
    }
  ],
  "callToAction": "Lời kêu gọi có cảm xúc, tối đa 20 từ — Follow/Like để không bỏ lỡ"
}

TỔNG THỜI LƯỢNG: 50-90 giây. Dùng ít nhất 2 loại scene_type khác nhau.
TUYỆT ĐỐI KHÔNG: viết câu dưới 20 từ cho narration, dùng bullet point kiểu liệt kê.
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
      
      // Normalize to VideoScript format — forward all scene_type fields
      script = {
        title: parsed.title || article.title.slice(0, 60),
        hook: parsed.hook || parsed.title || "",
        scenes: (parsed.scenes || []).map((s: Record<string, unknown>) => ({
          narration: String(s.narration || s.text || s.content || ""),
          duration: Number(s.duration) || 6,
          visual_id: s.visual_id || VISUAL_IDS[Math.floor(Math.random() * VISUAL_IDS.length)],
          scene_type: s.scene_type || "normal",
          // counter fields
          counter_end: s.counter_end !== undefined ? Number(s.counter_end) : undefined,
          counter_label: s.counter_label ? String(s.counter_label) : undefined,
          counter_suffix: s.counter_suffix !== undefined ? String(s.counter_suffix) : undefined,
          counter_prefix: s.counter_prefix ? String(s.counter_prefix) : undefined,
          // vs_screen fields
          vs_left: s.vs_left ? String(s.vs_left) : undefined,
          vs_right: s.vs_right ? String(s.vs_right) : undefined,
          vs_left_color: s.vs_left_color ? String(s.vs_left_color) : undefined,
          vs_right_color: s.vs_right_color ? String(s.vs_right_color) : undefined,
          // terminal fields
          terminal_title: s.terminal_title ? String(s.terminal_title) : undefined,
          terminal_lines: Array.isArray(s.terminal_lines) ? s.terminal_lines.map(String) : undefined,
          // checklist fields
          checklist_items: Array.isArray(s.checklist_items) ? s.checklist_items.map(String) : undefined,
          // progress_bar fields
          progress_target: s.progress_target !== undefined ? Number(s.progress_target) : undefined,
          progress_label: s.progress_label ? String(s.progress_label) : undefined,
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
