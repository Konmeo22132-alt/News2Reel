/**
 * News Scraper — extracts article title + content + ALL images from a URL.
 */

import type { ScrapedArticle } from "./types";

const CONTENT_SELECTORS = [
  ".fck_detail",
  ".detail-content .fck_detail",
  ".detail-content",
  ".detail__content",
  ".detail-content__body",
  ".singular-content",
  ".dt-news__content",
  ".content-detail",
  ".maincontent",
  ".knc-content",
  ".baomoi-content",
  "article .content-detail",
  "article .article-body",
  '[class*="article-content"]',
  '[class*="detail-content"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  ".article-body",
  ".article-content",
  "article",
  '[role="main"] article',
  '[role="main"]',
  "main article",
  "main",
  ".content",
  "#content",
];

// NOTE: "figure" và "iframe" đã bị xóa khỏi đây — cần giữ lại để extract ảnh
const NOISE_SELECTORS = [
  "script", "style", "nav", "header", "footer", "aside",
  ".advertisement", ".ads", '[class*="ad-"]', '[class*="popup"]',
  '[class*="cookie"]', '[class*="share"]', '[class*="social"]',
  '[class*="related"]', ".sidebar", ".sidebar-2", "#sidebar",
  ".box-morelink", ".related_news", ".block_related", ".block-related",
  ".tag-events", ".box-tinlienquan", ".box-tinlienquanv2",
  ".tab-comment", ".comment-section",
  "[class*='author-box']", "[class*='recommend']", "[class*='newsletter']",
];

const IMG_ATTRS = ["src", "data-src", "data-original", "data-lazy-src", "data-srcset"];

function cleanText(raw: string): string {
  return raw
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeUrl(src: string): string {
  try {
    const u = new URL(src);
    ["utm_source", "utm_medium", "utm_campaign", "fbclid"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return src;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchAmpVersion(url: string): Promise<string | null> {
  try {
    const ampUrl = url.replace("://", "://amp.") + (url.includes("?") ? "&" : "?") + "amp=1";
    const res = await fetch(ampUrl, {
      headers: { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return res.text();
  } catch { /* ignore */ }
  return null;
}

async function extractContent(html: string): Promise<{
  title: string;
  content: string;
  imageUrls: string[];
}> {
  const { load } = await import("cheerio");
  const $ = load(html);

  // Tìm content root trước để scope ảnh vào đúng phần bài viết
  let contentRoot = "body";
  for (const sel of CONTENT_SELECTORS) {
    try {
      if ($(sel).first().length) {
        contentRoot = sel;
        break;
      }
    } catch { /* skip */ }
  }

  // ── Extract images ────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const imageUrls: string[] = [];

  const addImage = (src: string | undefined) => {
    if (!src) return;
    const url = src.startsWith("//") ? "https:" + src : src;
    if (!url.startsWith("http")) return;
    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    imageUrls.push(normalized);
  };

  // Tất cả <img> trong body bài viết, kiểm tra nhiều lazy-load attributes
  $(`${contentRoot} img`).each((_, el) => {
    // Bỏ qua pixel tracker và icon nhỏ
    const w = parseInt($(el).attr("width") || "0");
    const h = parseInt($(el).attr("height") || "0");
    if ((w > 0 && w < 50) || (h > 0 && h < 50)) return;

    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (alt === "logo" || alt === "icon") return;

    for (const attr of IMG_ATTRS) {
      const val = $(el).attr(attr);
      if (val && !val.includes("data:image")) {
        // srcset chứa nhiều URL — lấy cái lớn nhất (cuối cùng)
        if (attr === "data-srcset" || (attr === "src" && val.includes(" "))) {
          const largest = val.trim().split(",").pop()?.trim().split(" ")[0];
          addImage(largest);
        } else {
          addImage(val);
        }
        break;
      }
    }
  });

  // <figure> images (VnExpress wrap ảnh chính trong <figure>)
  $(`${contentRoot} figure img`).each((_, el) => {
    for (const attr of IMG_ATTRS) {
      const val = $(el).attr(attr);
      if (val) { addImage(val); break; }
    }
  });

  // OG/Twitter meta — thêm vào cuối, deduplicate tự động
  const ogImage =
    $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content");
  addImage(ogImage);

  // ── Remove noise cho text extraction ─────────────────────────────────────
  $(NOISE_SELECTORS.join(", ")).remove();

  // ── Title ─────────────────────────────────────────────────────────────────
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text().split("|")[0] ||
    "Bài viết";

  // ── Content ───────────────────────────────────────────────────────────────
  let content = "";
  let bestLen = 0;
  for (const sel of CONTENT_SELECTORS) {
    try {
      const el = $(sel).first();
      if (!el.length) continue;
      const clone = el.clone();
      clone.find(NOISE_SELECTORS.join(", ")).remove();
      const text = cleanText(clone.text());
      if (text.length > 300 && text.length > bestLen) {
        content = text;
        bestLen = text.length;
        if (bestLen > 800) break;
      }
    } catch { /* skip */ }
  }

  if (!content || content.length < 200) {
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 50) paragraphs.push(t);
    });
    content = paragraphs.join("\n\n");
  }

  if (!content || content.length < 100) {
    try {
      const ldJson = $("script[type='application/ld+json']").first().html();
      if (ldJson) {
        const data = JSON.parse(ldJson);
        if (data.description && data.description.length > 50) content = data.description;
      }
    } catch { /* ignore */ }
  }

  return {
    title: cleanText(title).slice(0, 200),
    content: cleanText(content).slice(0, 8000),
    imageUrls,
  };
}

export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  let html = await fetchHtml(url);
  let { title, content, imageUrls } = await extractContent(html);

  if (content.length < 250) {
    const ampHtml = await fetchAmpVersion(url);
    if (ampHtml) {
      const ampResult = await extractContent(ampHtml);
      if (ampResult.content.length > content.length) {
        ({ title, content, imageUrls } = ampResult);
      }
    }
  }

  if (!content || content.length < 50) {
    throw new Error(
      `Không thể trích xuất nội dung từ ${url}.\n` +
      `Lưu ý: Một số trang dùng JavaScript để render, cần nhập URL bài viết cụ thể (không phải trang chủ).`
    );
  }

  console.log(`[Scraper] Extracted ${imageUrls.length} images from article`);
  return { title, content, url, imageUrls };
}

export function pickRandomSource(newsSourcesJson: string): string | null {
  try {
    const sources: string[] = JSON.parse(newsSourcesJson);
    if (!sources.length) return null;
    return sources[Math.floor(Math.random() * sources.length)];
  } catch {
    return null;
  }
}