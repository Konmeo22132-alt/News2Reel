import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "public", "videos");
const TMP_DIR = path.join(process.cwd(), ".tmp");

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

/**
 * Sweeps through the output videos directory and internal temporary 
 * directory, safely unlinking any file or folder older than 3 hours.
 */
export function cleanupStaleFiles() {
  const now = Date.now();

  try {
    // 1. Clean up public/videos/*.mp4
    if (fs.existsSync(OUTPUT_DIR)) {
      const files = fs.readdirSync(OUTPUT_DIR);
      for (const file of files) {
        if (!file.endsWith(".mp4")) continue;
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > THREE_HOURS_MS) {
          try {
            fs.unlinkSync(filePath);
            console.log(`[Cleanup] Deleted stale video: ${file}`);
          } catch {
            // ignore permission errors
          }
        }
      }
    }

    // 2. Clean up .tmp/ directories (in case of crash without finally cleanup)
    if (fs.existsSync(TMP_DIR)) {
      const dirs = fs.readdirSync(TMP_DIR);
      for (const dir of dirs) {
        const dirPath = path.join(TMP_DIR, dir);
        const stats = fs.statSync(dirPath);
        if (now - stats.mtimeMs > THREE_HOURS_MS) {
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`[Cleanup] Deleted stale temp dir: ${dir}`);
          } catch {
            // ignore lock errors
          }
        }
      }
    }
  } catch (error) {
    console.error("[Cleanup] Error during stale file cleanup:", error);
  }
}
