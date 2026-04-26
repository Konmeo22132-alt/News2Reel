import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VideoJobModel } from "@/lib/models/VideoJob";

/**
 * POST /api/jobs/[id]/cancel — Cancel a running job.
 * Sets status to "failed" with a cancellation message.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const job = await VideoJobModel.findOne({ jobId: id });
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job không tồn tại" },
        { status: 404 }
      );
    }

    // Only cancel jobs that are still running
    if (job.status !== "processing" && job.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `Không thể hủy job ở trạng thái "${job.status}"` },
        { status: 400 }
      );
    }

    await VideoJobModel.updateOne(
      { jobId: id },
      {
        $set: {
          status: "failed",
          currentStep: "Đã hủy bởi người dùng",
          errorDetails: "Job đã bị hủy bởi người dùng",
          completedAt: new Date(),
        },
        $push: { logs: "⛔ Job đã bị hủy bởi người dùng" },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Job đã được hủy thành công",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
