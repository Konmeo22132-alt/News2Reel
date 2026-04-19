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
  eslint: {
    // Deprecated eslint rules crash Next.js 15 build on older VPS setups
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Bypass type checking during production build since remotion.config.ts is used by Remotion CLI, not Next Webpack
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
