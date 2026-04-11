/**
 * POST /api/jobs/process
 * Internal endpoint — called by /api/jobs/trigger to run the pipeline
 * in a dedicated, long-lived HTTP request context.
 *
 * This route has no timeout limit (maxDuration = 300s on Vercel, unlimited locally).
 * It runs synchronously so the pipeline completes before the response returns.
 */

import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/app/actions/config";
import { processVideoJob } from "@/lib/job-processor";
import type { AppConfig } from "@/lib/types";

// Disable Next.js static opt + set long timeout for production deployments
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Vercel Pro limit)

export async function POST(request: NextRequest) {
  try {
    const { jobId, sourceUrl } = await request.json();

    if (!jobId || !sourceUrl) {
      return NextResponse.json({ error: "Missing jobId or sourceUrl" }, { status: 400 });
    }

    const config = await getConfig();

    // Run synchronously — this request stays open until pipeline finishes
    await processVideoJob(jobId, sourceUrl, config as AppConfig);

    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process] Pipeline error:", msg);
    // Job status is already set to "failed" by processVideoJob
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
