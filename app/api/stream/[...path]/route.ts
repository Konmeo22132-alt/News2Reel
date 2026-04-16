import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function iteratorToStream(iterator: AsyncGenerator<any, void, unknown>) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(new Uint8Array(value));
      }
    },
  });
}

function nodeStreamToIterator(stream: fs.ReadStream) {
  return (async function* () {
    for await (const chunk of stream) {
      yield chunk;
    }
  })();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const fileParams = await params;
    // Tự động nối các param mảng thành path thực tế. VD: /api/stream/videos/123.mp4 -> public/videos/123.mp4
    const filePath = path.join(process.cwd(), "public", ...fileParams.path);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      
      const file = fs.createReadStream(filePath, { start, end });
      const stream = iteratorToStream(nodeStreamToIterator(file));

      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    } else {
      const file = fs.createReadStream(filePath);
      const stream = iteratorToStream(nodeStreamToIterator(file));
      
      return new NextResponse(stream, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    }
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
