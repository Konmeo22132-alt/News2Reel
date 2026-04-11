/**
 * TikTok Publisher — uploads a video to TikTok via Content Posting API.
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * Flow:
 *  1. Init upload → get upload_url + publish_id
 *  2. PUT video file to upload_url
 *  3. Poll publish_id until PUBLISH_COMPLETE
 */

import path from "path";
import fs from "fs";

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export type TikTokCredentials = {
  appKey: string;
  appSecret: string;
  // Note: In production, you'd need a user access_token via OAuth.
  // This module uses app-level credentials for Content Posting API.
  accessToken?: string;
};

type InitUploadResponse = {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: { code: string; message: string };
};

type StatusResponse = {
  data: {
    status: string; // PROCESSING_UPLOAD | SEND_TO_USER_INBOX | FAILED | PUBLISH_COMPLETE
    fail_reason?: string;
  };
  error: { code: string; message: string };
};

export async function publishToTikTok(
  localVideoPath: string,
  caption: string,
  creds: TikTokCredentials
): Promise<{ publishId: string }> {
  if (!creds.accessToken) {
    throw new Error(
      "Cần access_token người dùng TikTok. Vui lòng hoàn tất OAuth flow."
    );
  }

  const absPath = localVideoPath.startsWith("/")
    ? path.join(process.cwd(), "public", localVideoPath)
    : localVideoPath;

  const stats = fs.statSync(absPath);
  const fileSize = stats.size;

  // 1. Init upload
  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const initData: InitUploadResponse = await initRes.json();
  if (initData.error?.code !== "ok") {
    throw new Error(`TikTok init error: ${initData.error?.message}`);
  }

  const { publish_id, upload_url } = initData.data;

  // 2. Upload video file
  const videoBuffer = fs.readFileSync(absPath);
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
      "Content-Length": String(fileSize),
    },
    body: videoBuffer,
    signal: AbortSignal.timeout(300_000), // 5 min for upload
  });

  if (!uploadRes.ok) {
    throw new Error(`TikTok upload failed: HTTP ${uploadRes.status}`);
  }

  // 3. Poll status (up to 3 minutes)
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusRes = await fetch(
      `${TIKTOK_API}/post/publish/status/fetch/?publish_id=${publish_id}`,
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      }
    );
    const statusData: StatusResponse = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "PUBLISH_COMPLETE") {
      return { publishId: publish_id };
    }

    if (status === "FAILED") {
      throw new Error(
        `TikTok publish failed: ${statusData.data?.fail_reason ?? "Unknown"}`
      );
    }
    // PROCESSING_UPLOAD | SEND_TO_USER_INBOX → keep polling
  }

  throw new Error("TikTok publish timeout sau 3 phút");
}
