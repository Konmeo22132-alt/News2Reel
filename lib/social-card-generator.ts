/**
 * social-card-generator.ts
 *
 * Generates Twitter/X card + VNExpress comments card HTML strings
 * from a ScrapedArticle + VideoScript.
 *
 * No LLM calls — deterministic rules based on article keywords.
 * All output is injected into templates/twitter-card-template.html
 * and templates/comments-card-template.html via {{PLACEHOLDER}} replacement.
 */

import fs from "fs";
import path from "path";
import type { ScrapedArticle, VideoScript } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ArticleCategory =
  | "war" | "economy" | "politics" | "tech" | "crime" | "disaster" | "default";

export interface TwitterCardData {
  displayName: string;
  handle: string;
  avatarLetter: string;
  avatarGradient: string;
  timestamp: string;
  badgeText: string;
  tweetBodyHtml: string;         // HTML allowed (spans for highlights)
  chipsHtml: string;             // pre-rendered chip HTML
  sourceLabel: string;
  sourceTitle: string;
  stats: { comments: string; retweets: string; likes: string; views: string };
  // Style tokens
  accentColor: string;
  accentColorDark: string;
  accentGlow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  sourceBorder: string;
  sourceBg: string;
  cardWidth: number;
}

export interface CommentData {
  name: string;
  location: string;
  initial: string;
  avatarGradient: string;
  text: string;              // HTML allowed
  likes: string;
  replies: string;
  featured: boolean;
}

export interface SocialCardSet {
  twitterCard: TwitterCardData;
  comments: CommentData[];
  narratorText: string;
  articleTitleShort: string;
  commentCountDisplay: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category detection
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<[ArticleCategory, RegExp]> = [
  ["war",      /chiến|tấn công|quân đội|bom|rocket|iran|ukraine|hamas|israel|nato|vũ khí|đạn|súng|tên lửa|xuồng|hải quân|phong tỏa|hormuz|xung đột/i],
  ["economy",  /kinh tế|gdp|lạm phát|chứng khoán|dầu|ngân hàng|tỷ giá|lãi suất|thị trường|doanh nghiệp|đất|bất động sản|bt|trả nợ/i],
  ["politics", /bầu cử|chính phủ|quốc hội|đảng|tổng thống|thủ tướng|chính sách|luật|nghị quyết|đại hội/i],
  ["tech",     /ai|robot|công nghệ|phần mềm|tesla|apple|google|meta|chip|điện toán|hack|mạng|cybersecurity/i],
  ["crime",    /bắt|khởi tố|điều tra|tội phạm|cảnh sát|vụ án|công an|gian lận|lừa đảo/i],
  ["disaster", /động đất|lũ lụt|cháy|thiên tai|bão|sóng thần|núi lửa|sạt lở/i],
];

function detectCategory(text: string): ArticleCategory {
  for (const [cat, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return cat;
  }
  return "default";
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryStyle {
  accent: string; accentDark: string; glow: string;
  badge: string; badgeBg: string; badgeBorder: string; badgeColor: string;
  avatarGradient: string;
  sourceBorder: string; sourceBg: string;
}

const STYLES: Record<ArticleCategory, CategoryStyle> = {
  war: {
    accent: "#ff4545", accentDark: "#b30000", glow: "rgba(255,69,69,0.3)",
    badge: "ĐANG CẬP NHẬT · XUNG ĐỘT QUÂN SỰ",
    badgeBg: "rgba(255,69,69,0.12)", badgeBorder: "rgba(255,69,69,0.45)", badgeColor: "#ff6b6b",
    avatarGradient: "linear-gradient(135deg,#ff4545,#c00020)",
    sourceBorder: "rgba(255,69,69,0.2)", sourceBg: "rgba(255,69,69,0.05)",
  },
  economy: {
    accent: "#f59e0b", accentDark: "#b45309", glow: "rgba(245,158,11,0.3)",
    badge: "TIN TỨC KINH TẾ · MỚI NHẤT",
    badgeBg: "rgba(245,158,11,0.12)", badgeBorder: "rgba(245,158,11,0.45)", badgeColor: "#fbbf24",
    avatarGradient: "linear-gradient(135deg,#f59e0b,#92400e)",
    sourceBorder: "rgba(245,158,11,0.2)", sourceBg: "rgba(245,158,11,0.05)",
  },
  politics: {
    accent: "#3b82f6", accentDark: "#1e40af", glow: "rgba(59,130,246,0.3)",
    badge: "TIN TỨC CHÍNH TRỊ",
    badgeBg: "rgba(59,130,246,0.12)", badgeBorder: "rgba(59,130,246,0.45)", badgeColor: "#60b4ff",
    avatarGradient: "linear-gradient(135deg,#3b82f6,#1e3a8a)",
    sourceBorder: "rgba(59,130,246,0.2)", sourceBg: "rgba(59,130,246,0.05)",
  },
  tech: {
    accent: "#a855f7", accentDark: "#6b21a8", glow: "rgba(168,85,247,0.3)",
    badge: "CÔNG NGHỆ · PHÁT HIỆN MỚI",
    badgeBg: "rgba(168,85,247,0.12)", badgeBorder: "rgba(168,85,247,0.45)", badgeColor: "#c084fc",
    avatarGradient: "linear-gradient(135deg,#a855f7,#6b21a8)",
    sourceBorder: "rgba(168,85,247,0.2)", sourceBg: "rgba(168,85,247,0.05)",
  },
  crime: {
    accent: "#ef4444", accentDark: "#991b1b", glow: "rgba(239,68,68,0.3)",
    badge: "PHÁP LUẬT · SỰ KIỆN NỔI BẬT",
    badgeBg: "rgba(239,68,68,0.12)", badgeBorder: "rgba(239,68,68,0.45)", badgeColor: "#f87171",
    avatarGradient: "linear-gradient(135deg,#ef4444,#7f1d1d)",
    sourceBorder: "rgba(239,68,68,0.2)", sourceBg: "rgba(239,68,68,0.05)",
  },
  disaster: {
    accent: "#f97316", accentDark: "#c2410c", glow: "rgba(249,115,22,0.3)",
    badge: "CẢNH BÁO KHẨN · THIÊN TAI",
    badgeBg: "rgba(249,115,22,0.12)", badgeBorder: "rgba(249,115,22,0.45)", badgeColor: "#fb923c",
    avatarGradient: "linear-gradient(135deg,#f97316,#7c2d12)",
    sourceBorder: "rgba(249,115,22,0.2)", sourceBg: "rgba(249,115,22,0.05)",
  },
  default: {
    accent: "#1d9bf0", accentDark: "#0369a1", glow: "rgba(29,155,240,0.3)",
    badge: "TIN TỨC MỚI NHẤT",
    badgeBg: "rgba(29,155,240,0.12)", badgeBorder: "rgba(29,155,240,0.45)", badgeColor: "#60b4ff",
    avatarGradient: "linear-gradient(135deg,#1d9bf0,#0369a1)",
    sourceBorder: "rgba(29,155,240,0.2)", sourceBg: "rgba(29,155,240,0.05)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fake accounts per category
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNTS: Record<ArticleCategory, { name: string; handle: string; letter: string }> = {
  war:      { name: "Thời Sự Quốc Tế",    handle: "@thoisuquocte",    letter: "T" },
  economy:  { name: "Phân Tích Kinh Tế",  handle: "@phantichtaichinh", letter: "P" },
  politics: { name: "Chính Trị Hôm Nay",  handle: "@chinhtrihomnay",  letter: "C" },
  tech:     { name: "Tech Insider VN",     handle: "@techinsidervn",   letter: "T" },
  crime:    { name: "Pháp Luật VN",        handle: "@phapluatvn",      letter: "P" },
  disaster: { name: "Cảnh Báo Khẩn",      handle: "@canhbaokhan",     letter: "C" },
  default:  { name: "Tin Tức Nóng 24H",   handle: "@tintucnong24h",   letter: "T" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fake engagement numbers (deterministic from title hash)
// ─────────────────────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h);
}

function fakeStats(seed: string) {
  const n = hash(seed);
  const views   = ((n % 5000) + 1000) * 1000;
  const likes   = Math.floor(views * 0.018 * (1 + (n % 3) * 0.3));
  const rts     = Math.floor(likes * 0.4);
  const comments = Math.floor(likes * 0.09);
  const fmt = (v: number) => v >= 1000000
    ? (v / 1000000).toFixed(1) + "M"
    : v >= 1000 ? (v / 1000).toFixed(1) + "K" : String(v);
  return { views: fmt(views), likes: fmt(likes), retweets: fmt(rts), comments: fmt(comments) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tweet body generation
// ─────────────────────────────────────────────────────────────────────────────

function buildTweetBody(article: ScrapedArticle, cat: ArticleCategory): string {
  // Use first 200 chars of content if available, else fallback to title
  const raw = article.content.length > 50
    ? article.content.slice(0, 220).replace(/\s+/g, " ").trim() + "..."
    : article.title;

  // Accent color class for this category
  const accent = STYLES[cat].accent;

  // Highlight numbers and key terms
  const highlighted = raw
    .replace(/(\d+[\.,]?\d*\s*[%tỷtrmbillionmillion%KMB]*)/g, `<span style="color:${accent};font-weight:700;">$1</span>`)
    .replace(/\b(TP\.HCM|TP\.HồChíMinh|Hà Nội|Iran|Mỹ|Ukraine|Nga|Israel|NATO|EU)\b/g, `<span style="color:#ffffff;font-weight:700;">$1</span>`);

  return highlighted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fact chips from article
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_ICONS: Record<ArticleCategory, string[]> = {
  war:      ["🚨", "🛥️", "💥", "📡"],
  economy:  ["💰", "📈", "🏦", "📊"],
  politics: ["🏛️", "📜", "🗳️", "🤝"],
  tech:     ["💻", "🤖", "⚡", "🔐"],
  crime:    ["🚔", "⚖️", "🔍", "📁"],
  disaster: ["🌊", "🔥", "⚠️", "🆘"],
  default:  ["📌", "🔔", "📰", "💡"],
};

function buildChipsHtml(script: VideoScript, cat: ArticleCategory): string {
  const icons = CHIP_ICONS[cat];
  // Use first 3 scene narrations as chip content (truncated)
  const scenes = script.scenes.slice(0, 4);
  let html = "";
  scenes.forEach((s, i) => {
    const text = s.narration.replace(/<\/?keyword>/g, "").slice(0, 80).trim() + (s.narration.length > 80 ? "..." : "");
    html += `<div class="chip"><span class="chip-icon">${icons[i % icons.length]}</span><span>${text}</span></div>`;
  });
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment templates per category: [alarmed, analytical, contrarian]
// ─────────────────────────────────────────────────────────────────────────────

interface CommentTemplate {
  name: string; initial: string; location: string; avatarGradient: string;
  textFn: (title: string) => string;
  likesSeed: number; repliesSeed: number;
  featured: boolean;
}

const COMMENT_TEMPLATES: Record<ArticleCategory, CommentTemplate[]> = {
  war: [
    {
      name: "Trung Nguyễn", initial: "T", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#f59e0b,#dc2626)",
      textFn: (title) => `<em>Đây không phải ngẫu nhiên.</em> Sự kiện "<strong>${title.slice(0, 50)}</strong>" cho thấy leo thang rõ rệt. Nếu không có ngoại giao khẩn cấp trong 48h tới, tình hình có thể vượt tầm kiểm soát.`,
      likesSeed: 4200, repliesSeed: 218, featured: true,
    },
    {
      name: "Hùng Phạm", initial: "H", location: "📍 TP.HCM",
      avatarGradient: "linear-gradient(135deg,#3b82f6,#1e40af)",
      textFn: () => `Nhìn từ góc kinh tế: tuyến vận chuyển bị đe dọa = <strong>giá xăng tăng</strong>, <em>logistics đứt gãy</em>, lạm phát chuỗi cung ứng. Việt Nam sẽ không tránh khỏi tác động gián tiếp.`,
      likesSeed: 2800, repliesSeed: 94, featured: false,
    },
    {
      name: "Long Lê", initial: "L", location: "📍 Đà Nẵng",
      avatarGradient: "linear-gradient(135deg,#10b981,#065f46)",
      textFn: () => `Cần bình tĩnh. <em>Đây là "ngoại giao bằng súng"</em> — khiêu khích để đàm phán, không phải chiến tranh toàn diện. Các bên đều hiểu <strong>cái giá thực sự của xung đột</strong>. Hãy theo dõi kênh ngoại giao song song.`,
      likesSeed: 1500, repliesSeed: 67, featured: false,
    },
  ],
  economy: [
    {
      name: "Minh Hoàng", initial: "M", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#f59e0b,#92400e)",
      textFn: (title) => `Đây là vấn đề <em>lợi ích nhóm nghiêm trọng</em>. Khi nhà nước bán "<strong>${title.slice(0, 40)}...</strong>", ai được hưởng lợi? Phải có đấu giá công khai, minh bạch 100%, không thể để xảy ra chuyện định giá thấp.`,
      likesSeed: 5100, repliesSeed: 342, featured: true,
    },
    {
      name: "Lan Trần", initial: "L", location: "📍 TP.HCM",
      avatarGradient: "linear-gradient(135deg,#6366f1,#4338ca)",
      textFn: () => `Về mặt tài chính công: trả nợ bằng tài sản là <strong>giải pháp hợp lý</strong> nếu dòng tiền ngân sách eo hẹp. Vấn đề là <em>định giá tài sản có sát thị trường không</em>? Nếu bán rẻ, đó là thất thoát ngân sách.`,
      likesSeed: 2300, repliesSeed: 88, featured: false,
    },
    {
      name: "Bảo Nguyễn", initial: "B", location: "📍 Cần Thơ",
      avatarGradient: "linear-gradient(135deg,#10b981,#064e3b)",
      textFn: () => `Mọi người lo quá. <em>Đây là chính sách bình thường</em> ở nhiều quốc gia — chính phủ monetize tài sản công để cân đối ngân sách. Quan trọng là <strong>quy trình đấu giá đúng luật</strong>. Hãy chờ kết quả thực tế.`,
      likesSeed: 980, repliesSeed: 43, featured: false,
    },
  ],
  politics: [
    {
      name: "Quang Phạm", initial: "Q", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#3b82f6,#1e3a8a)",
      textFn: (title) => `Quyết định về "<strong>${title.slice(0, 45)}...</strong>" sẽ có tác động lâu dài. <em>Chính sách nhất quán mới tạo được niềm tin.</em> Cần xem cách thực thi, không chỉ tờ nghị quyết.`,
      likesSeed: 3400, repliesSeed: 156, featured: true,
    },
    {
      name: "Thu Vũ", initial: "T", location: "📍 Huế",
      avatarGradient: "linear-gradient(135deg,#8b5cf6,#4c1d95)",
      textFn: () => `Điều tôi muốn biết là <strong>lộ trình triển khai cụ thể</strong> và <em>cơ chế giám sát độc lập</em>. Tuyên bố chính sách đẹp thì nhiều, nhưng accountability mới là thước đo thật.`,
      likesSeed: 1800, repliesSeed: 72, featured: false,
    },
    {
      name: "Đức Ngô", initial: "Đ", location: "📍 Đà Nẵng",
      avatarGradient: "linear-gradient(135deg,#06b6d4,#0e7490)",
      textFn: () => `Nhìn so sánh quốc tế: các nước phát triển cũng tranh luận về vấn đề tương tự. <em>Không có giải pháp hoàn hảo nào,</em> chỉ có <strong>đánh đổi khác nhau</strong>. Quan trọng là chọn đánh đổi nào ít tổn hại nhất.`,
      likesSeed: 1200, repliesSeed: 51, featured: false,
    },
  ],
  tech: [
    {
      name: "Tuấn Anh", initial: "T", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#a855f7,#6b21a8)",
      textFn: (title) => `<em>Đây mới chỉ là bề nổi.</em> "<strong>${title.slice(0, 45)}...</strong>" — ứng dụng thực tế sâu hơn nhiều. Trong 2-3 năm tới, ngành công nghiệp Việt Nam phải thích nghi hoặc tụt hậu.`,
      likesSeed: 6200, repliesSeed: 403, featured: true,
    },
    {
      name: "Hoa Cao", initial: "H", location: "📍 TP.HCM",
      avatarGradient: "linear-gradient(135deg,#22d3ee,#0e7490)",
      textFn: () => `Góc nhìn kỹ thuật: <strong>hạ tầng và nhân lực</strong> mới là nút thắt. Công nghệ tốt đến đâu mà không có người dùng đúng cách thì vẫn lãng phí. <em>Education-first mới bền vững.</em>`,
      likesSeed: 2900, repliesSeed: 118, featured: false,
    },
    {
      name: "Phúc Lê", initial: "P", location: "📍 Cần Thơ",
      avatarGradient: "linear-gradient(135deg,#f43f5e,#9f1239)",
      textFn: () => `Cần tỉnh táo với hype. <em>Mỗi công nghệ mới đều có vòng đời Gartner.</em> Chúng ta đang ở đỉnh kỳ vọng — <strong>thực tế sẽ khắc nghiệt hơn quảng cáo</strong> đáng kể. Hỏi: ai kiếm tiền từ hype này?`,
      likesSeed: 1400, repliesSeed: 89, featured: false,
    },
  ],
  crime: [
    {
      name: "Thanh Lê", initial: "T", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#ef4444,#7f1d1d)",
      textFn: (title) => `Vụ "<strong>${title.slice(0, 45)}...</strong>" — <em>đây không phải cá biệt.</em> Hệ thống kiểm soát nội bộ có vấn đề. Cần điều tra từ gốc rễ, không chỉ xử lý người bị bắt.`,
      likesSeed: 7800, repliesSeed: 521, featured: true,
    },
    {
      name: "Mai Trần", initial: "M", location: "📍 TP.HCM",
      avatarGradient: "linear-gradient(135deg,#f97316,#7c2d12)",
      textFn: () => `Luật pháp phải nghiêm. Nhưng điều quan trọng hơn là <strong>phòng ngừa</strong> — tại sao lỗ hổng này tồn tại lâu thế? <em>Ai có trách nhiệm giám sát</em> và có bị xử lý không?`,
      likesSeed: 3100, repliesSeed: 142, featured: false,
    },
    {
      name: "Linh Bùi", initial: "L", location: "📍 Hải Phòng",
      avatarGradient: "linear-gradient(135deg,#84cc16,#365314)",
      textFn: () => `<em>Hãy chờ kết luận điều tra chính thức</em> trước khi phán xét. Truyền thông đôi khi chạy trước sự thật. Tôi không bào chữa cho sai phạm, nhưng <strong>due process quan trọng</strong>.`,
      likesSeed: 890, repliesSeed: 38, featured: false,
    },
  ],
  disaster: [
    {
      name: "An Nguyễn", initial: "A", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#f97316,#c2410c)",
      textFn: (title) => `Tình trạng "<strong>${title.slice(0, 45)}...</strong>" — <em>biến đổi khí hậu đang hiện hữu.</em> Đây không còn là cảnh báo tương lai. Cơ sở hạ tầng của chúng ta đang chịu đựng quá giới hạn thiết kế.`,
      likesSeed: 5600, repliesSeed: 287, featured: true,
    },
    {
      name: "Hải Phan", initial: "H", location: "📍 Đà Nẵng",
      avatarGradient: "linear-gradient(135deg,#06b6d4,#164e63)",
      textFn: () => `Kinh nghiệm sống ở vùng hay bị ảnh hưởng: <strong>chuẩn bị trước mùa mưa bão</strong> là quan trọng nhất. Kit khẩn cấp, thuốc men, nước uống — <em>đừng chờ đến khi có tin cảnh báo mới lo.</em>`,
      likesSeed: 2400, repliesSeed: 103, featured: false,
    },
    {
      name: "Thảo Lê", initial: "T", location: "📍 Cần Thơ",
      avatarGradient: "linear-gradient(135deg,#8b5cf6,#581c87)",
      textFn: () => `Góc nhìn quy hoạch: <em>nhiều khu vực phát triển sai vùng nguy hiểm.</em> Thiên tai sẽ còn tệ hơn nếu tiếp tục bê tông hóa vùng ngập lũ. <strong>Quy hoạch bền vững</strong> phải là ưu tiên quốc gia.`,
      likesSeed: 1700, repliesSeed: 74, featured: false,
    },
  ],
  default: [
    {
      name: "Tuấn Nguyễn", initial: "T", location: "📍 Hà Nội",
      avatarGradient: "linear-gradient(135deg,#1d9bf0,#0369a1)",
      textFn: (title) => `Sự kiện "<strong>${title.slice(0, 50)}...</strong>" — <em>cần theo dõi diễn biến tiếp theo.</em> Đây có thể là bước ngoặt quan trọng nếu xử lý đúng hướng.`,
      likesSeed: 3200, repliesSeed: 145, featured: true,
    },
    {
      name: "Lan Vũ", initial: "L", location: "📍 TP.HCM",
      avatarGradient: "linear-gradient(135deg,#10b981,#065f46)",
      textFn: () => `Nhìn từ góc độ thực tế: <strong>tác động trực tiếp đến đời sống người dân</strong> mới là điều quan trọng nhất. <em>Chính sách tốt trên giấy nhưng khó thực thi</em> thì vẫn thất bại.`,
      likesSeed: 1900, repliesSeed: 82, featured: false,
    },
    {
      name: "Bình Trần", initial: "B", location: "📍 Đà Nẵng",
      avatarGradient: "linear-gradient(135deg,#f59e0b,#78350f)",
      textFn: () => `<em>Tôi có thể sai</em>, nhưng tôi thấy phân tích này còn quá đơn giản hóa. Thực tế phức tạp hơn — <strong>hãy xem cả hai chiều</strong> trước khi kết luận.`,
      likesSeed: 1100, repliesSeed: 56, featured: false,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Narrator text per category
// ─────────────────────────────────────────────────────────────────────────────

const NARRATOR_TEXTS: Record<ArticleCategory, string> = {
  war:      "Độc giả chia thành hai luồng: lo ngại leo thang thật sự, và tin rằng đây là đòn ngoại giao. Dù thế nào, tác động kinh tế là điều chắc chắn — và Việt Nam không đứng ngoài.",
  economy:  "Cộng đồng tranh luận gay gắt về tính minh bạch và quy trình thực thi. Câu hỏi cốt lõi: ai được hưởng lợi, và cơ chế giám sát có đủ mạnh?",
  politics: "Nhiều ý kiến tán thành chủ trương nhưng đặt câu hỏi về thực thi. Điểm chung: cần cơ chế giám sát độc lập và accountability rõ ràng.",
  tech:     "Giữa làn sóng hype công nghệ, độc giả tỉnh táo hơn: hỏi về ứng dụng thực tế, nhân lực, và ai thực sự được hưởng lợi từ sự thay đổi này.",
  crime:    "Dư luận phẫn nộ nhưng cũng đặt câu hỏi về hệ thống: tại sao lỗ hổng tồn tại lâu, và trách nhiệm giám sát thuộc về ai?",
  disaster: "Thiên tai không còn là bất ngờ — đây là hệ quả của nhiều quyết định quy hoạch sai lầm tích lũy. Câu hỏi bây giờ là: ai có trách nhiệm, và thay đổi gì để tránh lần sau?",
  default:  "Độc giả có nhiều góc nhìn khác nhau. Điểm chung: cần thông tin minh bạch và theo dõi diễn biến thực tế trước khi đưa ra đánh giá cuối cùng.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Source label from URL
// ─────────────────────────────────────────────────────────────────────────────

function buildSourceLabel(url: string, cat: ArticleCategory): string {
  const LABELS: Record<ArticleCategory, string> = {
    war:      "VnExpress · Thế giới · Quân sự",
    economy:  "VnExpress · Kinh doanh · Bất động sản",
    politics: "VnExpress · Thời sự · Chính trị",
    tech:     "VnExpress · Khoa học Công nghệ",
    crime:    "VnExpress · Pháp luật",
    disaster: "VnExpress · Thời sự · Thiên tai",
    default:  "VnExpress · Tin tức",
  };
  if (url.includes("tuoitre")) return "Tuổi Trẻ · " + LABELS[cat].split("·")[1];
  if (url.includes("thanhnien")) return "Thanh Niên · " + LABELS[cat].split("·")[1];
  if (url.includes("dantri")) return "Dân Trí · " + LABELS[cat].split("·")[1];
  return LABELS[cat];
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML generation
// ─────────────────────────────────────────────────────────────────────────────

function likesDisplay(seed: number, titleHash: number): string {
  const n = seed + (titleHash % 1000);
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
}

function renderTwitterCardHtml(data: TwitterCardData, templatePath: string): string {
  let html = fs.readFileSync(templatePath, "utf-8");
  
  const cssVars = `
<style>
  :root {
    --card-width: ${data.cardWidth}px;
    --accent-color: ${data.accentColor};
    --accent-color-dark: ${data.accentColorDark};
    --accent-glow: ${data.accentGlow};
    --badge-bg: ${data.badgeBg};
    --badge-border: ${data.badgeBorder};
    --badge-color: ${data.badgeColor};
    --avatar-gradient: ${data.avatarGradient};
    --source-border: ${data.sourceBorder};
    --source-bg: ${data.sourceBg};
  }
</style>`;

  const replacements: Record<string, string> = {
    "{{CSS_VARS}}":         cssVars,
    "{{BADGE_TEXT}}":       data.badgeText,
    "{{AVATAR_LETTER}}":    data.avatarLetter,
    "{{DISPLAY_NAME}}":     data.displayName,
    "{{HANDLE}}":           data.handle,
    "{{TIMESTAMP}}":        data.timestamp,
    "{{TWEET_BODY}}":       data.tweetBodyHtml,
    "{{CHIPS_HTML}}":       data.chipsHtml,
    "{{SOURCE_LABEL}}":     data.sourceLabel,
    "{{SOURCE_TITLE}}":     data.sourceTitle,
    "{{STAT_COMMENTS}}":    data.stats.comments,
    "{{STAT_RETWEETS}}":    data.stats.retweets,
    "{{STAT_LIKES}}":       data.stats.likes,
    "{{STAT_VIEWS}}":       data.stats.views,
  };
  
  for (const [key, val] of Object.entries(replacements)) {
    html = html.replaceAll(key, val);
  }
  return html;
}

function renderCommentsCardHtml(
  set: SocialCardSet,
  templatePath: string,
): string {
  let html = fs.readFileSync(templatePath, "utf-8");

  // Build comments HTML block
  const titleHash = hash(set.articleTitleShort);
  const commentsBlock = set.comments.map((c) => {
    const featuredClass = c.featured ? " featured" : "";
    const likedClass = c.featured ? " liked" : "";
    return `
<div class="comment${featuredClass}">
  <div class="av" style="background:${c.avatarGradient};">${c.initial}</div>
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="c-name">${c.name}</span>
      <span class="c-loc">${c.location}</span>
      <span class="c-time">• ${Math.floor(Math.random() * 4) + 1}h trước</span>
    </div>
    <div class="c-text">${c.text}</div>
    <div class="c-actions">
      <div class="c-like${likedClass}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/></svg>
        ${likesDisplay(c.featured ? titleHash % 3000 + 1000 : titleHash % 1500 + 400, titleHash)} thích
      </div>
      <div class="c-reply">💬 ${Math.floor(titleHash % 200) + 30} phản hồi</div>
    </div>
  </div>
</div>`;
  }).join("");

  const cssVars = `
<style>
  :root {
    --card-width: ${set.twitterCard.cardWidth}px;
  }
</style>`;

  const replacements: Record<string, string> = {
    "{{CSS_VARS}}":              cssVars,
    "{{ARTICLE_TITLE_SHORT}}":   set.articleTitleShort,
    "{{COMMENT_COUNT}}":         set.commentCountDisplay,
    "{{COMMENTS_HTML}}":         commentsBlock,
    "{{NARRATOR_TEXT}}":         set.narratorText,
  };
  for (const [key, val] of Object.entries(replacements)) {
    html = html.replaceAll(key, val);
  }
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main public API
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedCardHtmls {
  twitterCardHtml: string;
  commentsCardHtml: string;
}

export function generateSocialCards(
  article: ScrapedArticle,
  script: VideoScript,
  cardWidth = 1040,
): GeneratedCardHtmls {
  const templateDir = path.join(process.cwd(), "templates");
  const twitterTemplatePath = path.join(templateDir, "twitter-card-template.html");
  const commentsTemplatePath = path.join(templateDir, "comments-card-template.html");

  const cat = detectCategory(article.title + " " + article.content.slice(0, 300));
  const style = STYLES[cat];
  const account = ACCOUNTS[cat];
  const stats = fakeStats(article.title);
  const titleHash = hash(article.title);

  // Comments
  const commentTemplates = COMMENT_TEMPLATES[cat];
  const comments: CommentData[] = commentTemplates.map((t) => ({
    name: t.name,
    location: t.location,
    initial: t.initial,
    avatarGradient: t.avatarGradient,
    text: t.textFn(article.title),
    likes: likesDisplay(t.likesSeed, titleHash),
    replies: String(t.repliesSeed + (titleHash % 50)),
    featured: t.featured,
  }));

  const cardSet: SocialCardSet = {
    twitterCard: {
      displayName: account.name,
      handle: account.handle,
      avatarLetter: account.letter,
      avatarGradient: style.avatarGradient,
      timestamp: `${(titleHash % 3) + 1}${["", " giờ trước", " giờ trước"][titleHash % 3]} thuộc ${["vài", "vài", "mấy"][titleHash % 3]} giờ trước`,
      badgeText: style.badge,
      tweetBodyHtml: buildTweetBody(article, cat),
      chipsHtml: buildChipsHtml(script, cat),
      sourceLabel: buildSourceLabel(article.url, cat),
      sourceTitle: article.title,
      stats,
      accentColor: style.accent,
      accentColorDark: style.accentDark,
      accentGlow: style.glow,
      badgeBg: style.badgeBg,
      badgeBorder: style.badgeBorder,
      badgeColor: style.badgeColor,
      sourceBorder: style.sourceBorder,
      sourceBg: style.sourceBg,
      cardWidth,
    },
    comments,
    narratorText: NARRATOR_TEXTS[cat],
    articleTitleShort: article.title.slice(0, 55) + (article.title.length > 55 ? "..." : ""),
    commentCountDisplay: `${((titleHash % 2000) + 500).toLocaleString("vi-VN")}`,
  };

  return {
    twitterCardHtml: renderTwitterCardHtml(cardSet.twitterCard, twitterTemplatePath),
    commentsCardHtml: renderCommentsCardHtml(cardSet, commentsTemplatePath),
  };
}
