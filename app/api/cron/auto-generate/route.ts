/**
 * POST /api/cron/auto-generate
 * ============================
 * Cron endpoint: tự động scrape và tạo video theo lịch.
 *
 * Trigger:
 *   - Cron service (crontab, Vercel Cron, Uptime Robot): POST mỗi N giờ
 *   - Header: Authorization: Bearer CRON_SECRET (env var)
 *   - Body (optional): { engine?: "ffmpeg" | "remotion" | "hyperframes", sourceUrl?: string }
 *
 * Behavior:
 *   1. Check daily video limit — không tạo nếu đã đủ
 *   2. Pick random source từ config.newsSources
 *   3. Trigger job pipeline (không await — fire and forget)
 *   4. Return { ok: true, jobId }
 *
 * Security: Yêu cầu CRON_SECRET trong Authorization header.
 * Nếu không set env var, endpoint bị DISABLED.
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VideoJobModel } from "@/lib/models/VideoJob";
import { getConfig } from "@/app/actions/config";
import { randomUUID } from "crypto";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET environment variable not set — endpoint disabled" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── Load config ─────────────────────────────────────────────────────────────
  await connectDB();
  const config = await getConfig();

  if (!config.aiApiKey && !config.ClaudeApiKey) {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình API Key" }, { status: 400 });
  }

  // ── Check daily limit ────────────────────────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await VideoJobModel.countDocuments({
    createdAt: { $gte: todayStart },
    status: { $in: ["completed", "processing", "pending"] },
  });

  if (todayCount >= config.dailyVideoLimit) {
    return NextResponse.json({
      ok: false,
      error: `Đã đạt giới hạn ${config.dailyVideoLimit} video/ngày (hiện tại: ${todayCount})`,
    });
  }

  // ── Pick source URL ──────────────────────────────────────────────────────────
  let sources: string[] = [];
  try { sources = JSON.parse(config.newsSources); } catch {}

  // Allow caller to override
  const body = await req.json().catch(() => ({}));
  const sourceUrl: string = body.sourceUrl || sources[Math.floor(Math.random() * sources.length)];
  const engine: string = body.engine || "ffmpeg";

  if (!sourceUrl) {
    return NextResponse.json({
      ok: false,
      error: "Không có source URL — hãy cấu hình newsSources trong Settings",
    });
  }

  // ── Create job record ─────────────────────────────────────────────────────────
  const jobId = randomUUID();
  await VideoJobModel.create({
    jobId,
    sourceUrl,
    status: "pending",
    logs: [`[Cron] Auto-triggered at ${new Date().toISOString()}`],
    currentStep: "Khởi tạo",
    progress: 0,
    createdAt: new Date(),
  });

  // ── Fire pipeline (non-blocking) ─────────────────────────────────────────────
  setImmediate(async () => {
    try {
      const { processVideoJob } = await import("@/lib/job-processor");
      const { getConfig: reloadConfig } = await import("@/app/actions/config");
      const freshConfig = await reloadConfig();
      await processVideoJob(jobId, sourceUrl, engine as any, freshConfig as any);
    } catch (err) {
      console.error(`[Cron] Job ${jobId} failed:`, err);
    }
  });

  return NextResponse.json({
    ok: true,
    jobId,
    sourceUrl,
    engine,
    note: `Job đã được khởi tạo. Poll /api/jobs/${jobId} để theo dõi tiến trình.`,
  });
}

/**
 * GET /api/cron/auto-generate
 * Returns cron status info (no auth needed — public info only)
 */
export async function GET() {
  await connectDB();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await VideoJobModel.countDocuments({
    createdAt: { $gte: todayStart },
  });

  const config = await getConfig();

  return NextResponse.json({
    cronEnabled: !!CRON_SECRET,
    todayCount,
    dailyLimit: config.dailyVideoLimit,
    remaining: Math.max(0, config.dailyVideoLimit - todayCount),
    hint: CRON_SECRET
      ? "Send POST with Authorization: Bearer CRON_SECRET to trigger"
      : "Set CRON_SECRET env var to enable cron endpoint",
  });
}
