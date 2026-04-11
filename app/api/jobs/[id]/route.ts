import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { VideoJobModel } from "@/lib/models/VideoJob";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    // id is the UUID jobId
    const doc = await VideoJobModel.findOne({ jobId: id }).lean();

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Job không tồn tại" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: doc.jobId,
        sourceUrl: doc.sourceUrl,
        status: doc.status,
        resultUrl: doc.resultUrl ?? null,
        createdAt: doc.createdAt,
        completedAt: doc.completedAt ?? null,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Lỗi server" }, { status: 500 });
  }
}
