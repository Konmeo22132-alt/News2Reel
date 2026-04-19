import { Config } from "@remotion/cli/config";

// ⚠️ VPS SURVIVAL CONFIGURATION FOR LOW-RAM (2GB-4GB)
Config.setConcurrency(1);
// @ts-ignore - Expected by prompt override
if ('setChromiumArgs' in Config) {
  (Config as any).setChromiumArgs([
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
  ]);
}
Config.setChromiumOpenGlRenderer("angle");
