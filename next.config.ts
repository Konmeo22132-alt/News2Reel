import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "mongoose",
    "fluent-ffmpeg",
    "ffmpeg-static",
    "cheerio",
    "better-sqlite3",
  ],
};

export default nextConfig;
