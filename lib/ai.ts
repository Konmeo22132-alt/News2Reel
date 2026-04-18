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
4. Chọn visual_id từ: laptop, rocket, skull, warning, terminal, robot, chip, globe, lock, chart, dollar, fire, star, lightning, turtle, shield, dna, bell, scale
5. Chọn scene_type phù hợp (xem bên dưới)

LOẠI CẢNH (scene_type) - BẮT BUỘC PHẢI CHỌN:
- "normal": Cảnh thông thường. Hiển thị emoji icon + subtitle karaoke
- "counter": Khi bài có SỐ LIỆU (%, số người, thời gian). Hiện số đếm to nổi bật. Thêm: counter_end (số cuối), counter_label (nhãn), counter_suffix ("%" hoặc "")
- "vs_screen": Khi SO SÁNH 2 thứ. Thêm: vs_left (bên trái), vs_right (bên phải)
- "terminal": Khi đề cập KỸ THUẬT/CODE/CVE. Thêm: terminal_lines (mảng lệnh)
- "checklist": Khi liệt kê TÓM TẮT hoặc CTA cuối. Thêm: checklist_items (mảng)
- "progress_bar": Khi có TỈ LỆ PHẦN TRĂM/thị phần. Thêm: progress_target (%), progress_label

TRẢ VỀ JSON với cấu trúc CHÍNH XÁC (không thêm text ngoài JSON):
{
  "title": "Tiêu đề video ngắn gọn (tối đa 60 ký tự)",
  "hook": "Câu hook cực mạnh trong 3 giây đầu (tối đa 15 từ)",
  "scenes": [
    {
      "narration": "Nội dung cảnh thường với <keyword>từ quan trọng</keyword>",
      "duration": 6,
      "visual_id": "laptop",
      "scene_type": "normal"
    },
    {
      "narration": "Đã khai thác được 22 lỗ hổng trong 2 tuần",
      "duration": 5,
      "visual_id": "skull",
      "scene_type": "counter",
      "counter_end": 22,
      "counter_label": "lỗ hổng trong 2 tuần",
      "counter_suffix": ""
    },
    {
      "narration": "Con người không thể sánh với tốc độ AI",
      "duration": 6,
      "visual_id": "lightning",
      "scene_type": "vs_screen",
      "vs_left": "Human Response",
      "vs_right": "AI Speed"
    },
    {
      "narration": "AI đã chạy lệnh tấn công tự động",
      "duration": 7,
      "visual_id": "terminal",
      "scene_type": "terminal",
      "terminal_lines": ["> exploit --target CVE-2026-2796", "// Khai thác thành công..."]
    },
    {
      "narration": "Hãy làm ngay những bước này để bảo vệ bản thân",
      "duration": 8,
      "visual_id": "shield",
      "scene_type": "checklist",
      "checklist_items": ["Update Firefox", "Bật Sandbox", "Cảnh giác Wasm"]
    },
    {
      "narration": "WordPress chiếm 40% toàn bộ internet",
      "duration": 6,
      "visual_id": "globe",
      "scene_type": "progress_bar",
      "progress_target": 40,
      "progress_label": "Internet dùng WordPress"
    }
  ],
  "callToAction": "Lời kêu gọi hành động cuối video (tối đa 20 từ)"
}

QUY TẮC QUAN TRỌNG:
- Tổng thời lượng scenes từ 45-90 giây
- VIẾT BẰNG TIẾNG VIỆT TỰ NHIÊN, DỄ HIỂU
- Ngôn ngữ súc tích, KHÔNG RƯỜM RÀ
- Hook phải GÂY SỐC, buộc người xem xem tiếp
- Dùng ít nhất 2-3 loại scene_type khác nhau trong 1 video để video sinh động
- Không bọc tất cả từ trong keyword, CHỈ NHỮNG từ thật sự QUAN TRỌNG
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
