/**
 * News Scraper — extracts article title + content from a URL.
 *
 * Strategy:
 *   1. Try native fetch + cheerio (fast, works for server-rendered sites)
 *   2. If content < 200 chars (likely JS-rendered), fall back to fetching
 *      AMP version or Google cache.
 *
 * Works well with: vnexpress.net, tuoitre.vn, thanhnien.vn, dantri.com.vn,
 *                  baomoi.com, vietnamnet.vn, 24h.com.vn
 */

import type { ScrapedArticle } from "./types";

// Content selectors — ordered from most to least specific
// Vietnamese news sites use site-specific class names
const CONTENT_SELECTORS = [
  // VnExpress
  ".fck_detail",
  ".detail-content .fck_detail",
  // Tuổi Trẻ
  ".detail-content",
  ".detail__content",
  // Thanh Niên
  ".detail-content__body",
  // Dân Trí
  ".singular-content",
  ".dt-news__content",
  // VietnamNet
  ".content-detail",
  ".maincontent",
  // 24h
  ".knc-content",
  // Báo Mới
  ".baomoi-content",
  // Generic
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

const NOISE_SELECTORS = [
  "script", "style", "nav", "header", "footer", "aside",
  ".advertisement", ".ads", '[class*="ad-"]', '[class*="popup"]',
  '[class*="cookie"]', '[class*="share"]', '[class*="social"]',
  '[class*="related"]', ".sidebar", ".sidebar-2", "#sidebar", "figure", "iframe",
  // VnExpress specific noise
  ".box-morelink", ".related_news", ".block_related", ".block-related",
  ".tag-events", ".box-tinlienquan", ".box-tinlienquanv2",
  ".tab-comment", ".comment-section",
  // Generic
  "[class*='author-box']", "[class*='recommend']", "[class*='newsletter']",
];

function cleanText(raw: string): string {
  return raw
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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

/** Try fetching Google AMP version for JS-heavy sites */
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

async function extractContent(html: string): Promise<{ title: string; content: string; imageUrls: string[] }> {
  const { load } = await import("cheerio");
  const $ = load(html);

  // ── Extract images BEFORE removing noise (need figure/img tags still present) ──
  const imageUrls: string[] = [];

  // Priority 1: OG/Twitter card image — always high resolution
  const ogImage = $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content");
  if (ogImage && ogImage.startsWith("http")) imageUrls.push(ogImage);

  // Priority 2: article body images (VNExpress, TuoiTre, etc.)
  $(".fck_detail img, .detail-content img, article img, .article-body img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original") || "";
    if (src.startsWith("http") && !imageUrls.includes(src)) {
      const w = parseInt($(el).attr("width") || "999");
      if (w === 1 || (w > 0 && w < 100)) return; // skip 1px trackers and tiny thumbnails
      imageUrls.push(src);
      if (imageUrls.length >= 6) return false; // max 6 images
    }
  });

  // Remove noise
  $(NOISE_SELECTORS.join(", ")).remove();

  // Extract title
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text().split("|")[0] ||
    "Bài viết";

  // Find best content block
  let content = "";
  let bestLen = 0;
  for (const sel of CONTENT_SELECTORS) {
    try {
      const el = $(sel).first();
      if (!el.length) continue;
      // Clone and remove noise from the candidate
      const clone = el.clone();
      clone.find(NOISE_SELECTORS.join(", ")).remove();
      const text = cleanText(clone.text());
      if (text.length > 300 && text.length > bestLen) {
        content = text;
        bestLen = text.length;
        // If we get a substantial amount, stop early
        if (bestLen > 800) break;
      }
    } catch { /* skip bad selectors */ }
  }

  // Fallback: collect all <p> tags with meaningful content
  if (!content || content.length < 200) {
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 50) paragraphs.push(t);
    });
    content = paragraphs.join("\n\n");
  }

  // Last resort: get description from JSON-LD
  if (!content || content.length < 100) {
    try {
      const ldJson = $("script[type='application/ld+json']").first().html();
      if (ldJson) {
        const data = JSON.parse(ldJson);
        if (data.description && data.description.length > 50) {
          content = data.description;
        }
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
  // Try primary fetch
  let html = await fetchHtml(url);
  let { title, content, imageUrls } = await extractContent(html);

  // If content seems empty or too short (JS-rendered site), try AMP fallback
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

/** Pick a random source from JSON array string */
export function pickRandomSource(newsSourcesJson: string): string | null {
  try {
    const sources: string[] = JSON.parse(newsSourcesJson);
    if (!sources.length) return null;
    return sources[Math.floor(Math.random() * sources.length)];
  } catch {
    return null;
  }
}
