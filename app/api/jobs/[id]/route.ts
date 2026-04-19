import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VideoJobModel } from "@/lib/models/VideoJob";
import os from "os";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const doc = await VideoJobModel.findOne({ jobId: id }).lean();

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Job không tồn tại" },
        { status: 404 }
      );
    }

    // --- Calculate System Resources & ETA ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    
    // CPU Load average over 1 minute relatively to cores
    const cpus = os.cpus().length;
    const cpuLoad = Math.round((os.loadavg()[0] / cpus) * 100);

    // ETA Calculation based on progress
    let etaSeconds = 0;
    const progress = doc.progress ?? 0;
    if (progress > 0 && progress < 100 && doc.createdAt) {
      const elapsedMs = Date.now() - new Date(doc.createdAt).getTime();
      const totalEstimatedMs = elapsedMs / (progress / 100);
      etaSeconds = Math.round((totalEstimatedMs - elapsedMs) / 1000);
    }

    const systemStats = {
      ramPercent,
      cpuLoad: Math.min(cpuLoad, 100), // Cap at 100% structurally
      etaSeconds,
      vCpus: cpus
    };

    return NextResponse.json({
      success: true,
      systemStats,
      job: {
        id: doc.jobId,
        sourceUrl: doc.sourceUrl,
        status: doc.status,
        resultUrl: doc.resultUrl ?? null,
        logs: doc.logs ?? [],
        currentStep: doc.currentStep ?? "Đang khởi tạo",
        progress,
        errorDetails: doc.errorDetails ?? null,
        createdAt: doc.createdAt,
        completedAt: doc.completedAt ?? null,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Lỗi server" }, { status: 500 });
  }
}

