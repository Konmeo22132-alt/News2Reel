/**
 * News Scraper — extracts article title + content from a URL.
 *
 * Strategy:
 *   1. Try native fetch + cheerio (fast, works for server-rendered sites)
 *   2. If content < 200 chars (likely JS-rendered), fall back to fetching
 *      Google's cached version or AMP version.
 *
 * Works well with: vnexpress.net, tuoitre.vn, thanhnien.vn, dantri.com.vn,
 *                  baomoi.com, vietnamnet.vn, 24h.com.vn
 */

import type { ScrapedArticle } from "./types";

// Content selectors — ordered from most to least specific
const CONTENT_SELECTORS = [
  "article .content-detail",
  "article .article-body",
  '[class*="article-content"]',
  '[class*="detail-content"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  "article",
  '[role="main"]',
  "main",
  ".content",
  "#content",
];

const NOISE_SELECTORS = [
  "script", "style", "nav", "header", "footer", "aside",
  ".advertisement", ".ads", ".ad-", '[class*="popup"]',
  '[class*="cookie"]', '[class*="share"]', '[class*="social"]',
  '[class*="related"]', '[class*="sidebar"]', "figure", "iframe",
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
        "Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
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

async function extractContent(html: string): Promise<{ title: string; content: string }> {
  const { load } = await import("cheerio");
  const $ = load(html);

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
  for (const sel of CONTENT_SELECTORS) {
    const el = $(sel).first();
    const text = el.text();
    if (el.length && text.length > 300) {
      content = text;
      break;
    }
  }

  // Fallback: collect all paragraphs
  if (!content || content.length < 200) {
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 40) paragraphs.push(t);
    });
    content = paragraphs.join("\n\n");
  }

  return {
    title: cleanText(title).slice(0, 200),
    content: cleanText(content).slice(0, 5000),
  };
}

export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  // Try primary fetch
  let html = await fetchHtml(url);
  let { title, content } = await extractContent(html);

  // If content seems empty or too short (JS-rendered site), try AMP fallback
  if (content.length < 250) {
    const ampHtml = await fetchAmpVersion(url);
    if (ampHtml) {
      const ampResult = await extractContent(ampHtml);
      if (ampResult.content.length > content.length) {
        ({ title, content } = ampResult);
      }
    }
  }

  if (!content || content.length < 50) {
    throw new Error(
      `Không thể trích xuất nội dung từ ${url}.\n` +
      `Lưu ý: Một số trang dùng JavaScript để render, cần nhập URL bài viết cụ thể (không phải trang chủ).`
    );
  }

  return { title, content, url };
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
