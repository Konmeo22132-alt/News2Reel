/**
 * playwright-screenshot.ts
 *
 * Screenshots HTML content to PNG using headless Chromium (Playwright).
 * Background is transparent so the PNG can be composited over video in FFmpeg.
 *
 * Install once on server:
 *   npm install playwright
 *   npx playwright install chromium --with-deps
 */

import fs from "fs";
import path from "path";

export interface ScreenshotOptions {
  width?: number;   // viewport width (default: 1040)
  scale?: number;   // devicePixelRatio (default: 1 — use 2 for hi-DPI)
  waitMs?: number;  // extra wait for fonts/animations (default: 1500)
}

/**
 * Take a transparent-background PNG screenshot of an HTML string.
 * Returns the output path on success, null if playwright is not available.
 */
export async function screenshotHTML(
  html: string,
  outputPath: string,
  opts: ScreenshotOptions = {},
): Promise<string | null> {
  const { width = 1040, scale = 1, waitMs = 1500 } = opts;

  // Dynamic import — graceful degradation if playwright not installed
  let chromium: import("playwright").BrowserType;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.warn(
      "[Screenshot] playwright not installed.\n" +
      "  Run: npm install playwright && npx playwright install chromium --with-deps"
    );
    return null;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    // ── Pass 1: measure actual content height ──────────────────────────────
    const ctx1 = await browser.newContext({
      viewport: { width, height: 1200 },
      deviceScaleFactor: scale,
    });
    const page1 = await ctx1.newPage();
    await page1.setContent(html, { waitUntil: "networkidle" });
    await page1.waitForTimeout(waitMs);

    const contentHeight = await page1.evaluate(() => {
      document.body.style.padding = "0";
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
    });
    await ctx1.close();

    // ── Pass 2: screenshot at exact content dimensions ─────────────────────
    const ctx2 = await browser.newContext({
      viewport: { width, height: contentHeight + 40 }, // +40 for bottom padding
      deviceScaleFactor: scale,
    });
    const page2 = await ctx2.newPage();
    await page2.setContent(html, { waitUntil: "networkidle" });
    await page2.waitForTimeout(800);

    // Ensure output dir exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    await page2.screenshot({
      path: outputPath,
      omitBackground: true,  // transparent PNG for FFmpeg compositing
      fullPage: false,        // use viewport exactly
      clip: { x: 0, y: 0, width, height: contentHeight + 40 },
    });
    await ctx2.close();

    console.log(`[Screenshot] ✓ ${path.basename(outputPath)} (${width}×${contentHeight}px)`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Screenshot multiple HTML strings in parallel (shared browser instance).
 * More efficient than calling screenshotHTML() sequentially.
 */
export async function screenshotBatch(
  items: Array<{ html: string; outputPath: string; opts?: ScreenshotOptions }>,
): Promise<(string | null)[]> {
  let chromium: import("playwright").BrowserType;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.warn("[Screenshot] playwright not installed — skipping all social cards.");
    return items.map(() => null);
  }

  const browser = await chromium.launch({ headless: true });
  const results: (string | null)[] = [];

  try {
    for (const item of items) {
      const { html, outputPath, opts = {} } = item;
      const { width = 1040, scale = 1, waitMs = 1500 } = opts;

      try {
        // Measure height
        const ctx1 = await browser.newContext({
          viewport: { width, height: 1200 },
          deviceScaleFactor: scale,
        });
        const p1 = await ctx1.newPage();
        await p1.setContent(html, { waitUntil: "networkidle" });
        await p1.waitForTimeout(waitMs);
        const contentHeight = await p1.evaluate(() =>
          Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        );
        await ctx1.close();

        // Screenshot
        const ctx2 = await browser.newContext({
          viewport: { width, height: contentHeight + 40 },
          deviceScaleFactor: scale,
        });
        const p2 = await ctx2.newPage();
        await p2.setContent(html, { waitUntil: "networkidle" });
        await p2.waitForTimeout(600);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        await p2.screenshot({
          path: outputPath,
          omitBackground: true,
          fullPage: false,
          clip: { x: 0, y: 0, width, height: contentHeight + 40 },
        });
        await ctx2.close();

        console.log(`[Screenshot] ✓ ${path.basename(outputPath)}`);
        results.push(outputPath);
      } catch (e) {
        console.warn(`[Screenshot] ✗ Failed: ${path.basename(outputPath)} — ${e}`);
        results.push(null);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
