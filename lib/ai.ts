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
      "context_image_url": "URL ảnh từ danh sách ảnh đã cung cấp phù hợp nhất với cảnh này (hoặc null nếu không có ảnh phù hợp)"
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

/**
 * Build OpenAI-compatible multimodal user message.
 * Gửi tối đa MAX_IMAGES ảnh cùng bài viết để AI "nhìn" ngữ cảnh hình ảnh.
 */
const MAX_VISION_IMAGES = 5;

function buildUserMessage(
  article: ScrapedArticle,
): Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> {
  const textPart = {
    type: "text",
    text: [
      `Bài viết:\nTiêu đề: ${article.title}`,
      `\nNội dung:\n${article.content}`,
      article.imageUrls?.length
        ? `\n\nDanh sách URL ảnh của bài viết (chọn URL phù hợp nhất cho từng scene):\n${article.imageUrls.slice(0, MAX_VISION_IMAGES).map((u, i) => `[${i}] ${u}`).join("\n")}`
        : "",
    ].join(""),
  };

  // Chỉ gửi ảnh khi có và model hỗ trợ vision
  const imageParts = (article.imageUrls ?? [])
    .slice(0, MAX_VISION_IMAGES)
    .map((url) => ({
      type: "image_url",
      image_url: { url, detail: "low" } as { url: string; detail: string },
    }));

  return [textPart, ...imageParts];
}

// ─── Vision Agent ─────────────────────────────────────────────────────────────
/**
 * Dual-agent meeting:
 * 1. Vision Agent: nhìn ảnh, mô tả chi tiết ngữ cảnh, người, tình huống
 * 2. Script Writer: nhận brief từ Vision Agent, viết kịch bản sâu hơn, đúng hơn
 *
 * Returns a text brief string (đưa vào system prompt của Script Writer).
 */
async function analyzeImagesWithVisionAgent(opts: {
  imageUrls: string[];
  articleTitle: string;
  visionApiKey: string;
  visionProvider: string;
  visionModel: string;
}): Promise<string> {
  const { imageUrls, articleTitle, visionApiKey, visionProvider, visionModel } = opts;
  const apiUrl = PROVIDER_URLS[visionProvider] ?? PROVIDER_URLS.beeknoee;
  const imgs = imageUrls.slice(0, MAX_VISION_IMAGES);

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: [
        `Bạn là Vision Agent. Nhiệm vụ: nhìn vào các ảnh sau và mô tả chi tiết nhất có thể.`,
        `Tiêu đề bài viết: "${articleTitle}"`,
        ``,
        `Với mỗi ảnh, hãy cung cấp:`,
        `1. Mô tả nội dung chính (người/sự kiện/cảnh vật)`,
        `2. Không khí/cảm xúc (kịch tính/tăng trưởng/đáng ngại/lạc quan...)`,
        `3. URL ảnh nào phù hợp nhất cho scene nào (hook/nội dung chính/CTA)`,
        `4. Nhiều chi tiết đặc biệt nào trong ảnh có thể tạo hóok tốt cho video ngắn?`,
        ``,
        `Trả về bảng tóm tắt dạng markdown ngắn gọn (được dùng để brief cho script writer).`,
      ].join("\n"),
    },
    ...imgs.map((url) => ({
      type: "image_url",
      image_url: { url, detail: "low" },
    })),
  ];

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${visionApiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [{ role: "user", content }],
        max_tokens: 1200,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[VisionAgent] Failed (${res.status}): ${err.slice(0, 200)}`);
      return "";
    }
    const json = await res.json();
    const brief = json?.choices?.[0]?.message?.content ?? "";
    console.log(`[VisionAgent] Brief (${brief.length} chars): ${brief.slice(0, 150)}...`);
    return brief;
  } catch (e) {
    console.warn(`[VisionAgent] Error:`, e);
    return "";
  }
}

export async function generateScript(
  article: ScrapedArticle,
  config: {
    apiKey: string;
    channelGoal: string;
    customPrompt?: string | null;
    aiProvider?: string;
    aiModel?: string | null;
    engine: "ffmpeg" | "remotion";
    useVision?: boolean;
    // Vision Agent (optional) — reads images, briefs script writer
    visionApiKey?: string | null;
    visionModel?: string | null;
    visionProvider?: string | null;
  }
): Promise<VideoScript> {
  const { apiKey, channelGoal, customPrompt } = config;
  const provider = config.aiProvider ?? "beeknoee";
  const apiUrl = ENV_BASE ? `${ENV_BASE}/chat/completions`
    : (PROVIDER_URLS[provider] ?? PROVIDER_URLS.beeknoee);
  const model = ENV_MODEL ?? config.aiModel ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.beeknoee;

  console.log(`[ScriptAgent] Provider: ${provider} | Model: ${model}`);

  const hasImages = (article.imageUrls?.length ?? 0) > 0;
  let visionEnabled = config.useVision !== false && hasImages;

  // ── Vision Agent: read images and brief script writer ──
  let visionBrief = "";
  const hasVisionAgent = !!(config.visionApiKey && config.visionModel);
  if (hasVisionAgent && hasImages) {
    console.log(`[VisionAgent] Running separate vision analysis (${config.visionModel})...`);
    visionBrief = await analyzeImagesWithVisionAgent({
      imageUrls: article.imageUrls ?? [],
      articleTitle: article.title,
      visionApiKey: config.visionApiKey!,
      visionProvider: config.visionProvider ?? config.aiProvider ?? "beeknoee",
      visionModel: config.visionModel!,
    });
    // When vision agent is running, script writer doesn't need to process images directly
    if (visionBrief) visionEnabled = false;
  }

  // Inject vision brief into system prompt when available
  const systemPrompt = SYSTEM_PROMPT(channelGoal, customPrompt ?? "", config.engine)
    + (visionBrief ? `\n\n═══ BÁO CÁO TỪ VISION AGENT ═══\n${visionBrief}\n═══════════════════════════` : "");

  const buildBody = (withVision: boolean) => {
    const userContent = withVision
      ? buildUserMessage(article)
      : `Bài viết:\nTiêu đề: ${article.title}\n\nNội dung:\n${article.content}`;
    return JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
      ],
      temperature: 0.8,
      max_tokens: 8000,
    });
  };

  if (visionEnabled) {
    console.log(`[ScriptAgent] Vision mode ON — gửi ${Math.min((article.imageUrls?.length ?? 0), MAX_VISION_IMAGES)} ảnh`);
  } else if (visionBrief) {
    console.log(`[ScriptAgent] Using Vision Agent brief (${visionBrief.length} chars)`);
  }

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
        body: buildBody(visionEnabled),
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

    // 400 khi vision mode — model không hỗ trợ multimodal → tự động tắt vision và retry
    if (response.status === 400 && visionEnabled) {
      const errBody = await response.text().catch(() => "");
      console.warn(`[AI] Vision 400 error, fallback to text-only: ${errBody.slice(0, 200)}`);
      visionEnabled = false;
      continue;
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
      const allImages = article.imageUrls ?? [];
      // Helper: validate URL phải thuộc article.imageUrls (chống AI hallucinate)
      const validateImgUrl = (url: unknown): string | undefined => {
        const s = String(url ?? "");
        if (!s.startsWith("http")) return undefined;
        // Accept if URL is in the scraped list, or if no list (fallback graceful)
        if (allImages.length === 0) return s;
        return allImages.includes(s) ? s : undefined;
      };

      script = {
        clickbait_title: String(parsed.clickbait_title || parsed.title || article.title.slice(0, 60)),
        fake_username: String(parsed.fake_username || "The Investigator"),
        context_image_url: validateImgUrl(parsed.context_image_url) ?? allImages[0] ?? undefined,
        hook: String(parsed.hook || parsed.title || ""),
        scenes: (parsed.scenes || []).map((s: Record<string, unknown>, idx: number) => {
          // Resolve context image: AI có thể trả về URL hoặc index
          let resolvedImageUrl: string | undefined;
          if (s.context_image_url && String(s.context_image_url).startsWith("http")) {
            resolvedImageUrl = validateImgUrl(s.context_image_url);
          } else if (s.context_image_index !== undefined) {
            resolvedImageUrl = allImages[Number(s.context_image_index)] ?? allImages[idx % allImages.length];
          } else if (allImages.length > 0) {
            // Fallback: phân phối ảnh theo scene index
            resolvedImageUrl = allImages[idx % allImages.length];
          }

          return {
            narration: String(s.narration || s.text || s.content || ""),
            duration: Number(s.duration) || 6,
            durationInFrames: s.durationInFrames ? Number(s.durationInFrames) : undefined,
            animationType: s.animationType ? String(s.animationType) : undefined,
            animationProps: s.animationProps && typeof s.animationProps === "object" ? s.animationProps : {},
            context_image_url: resolvedImageUrl,
            context_image_index: s.context_image_index !== undefined ? Number(s.context_image_index) : idx,
          };
        }),
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
