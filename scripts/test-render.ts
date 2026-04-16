import { renderTestScene } from "../lib/video-renderer";
import fs from "fs";

async function main() {
    console.log("Starting quick render test...");
    try {
        const narration = "Đây là một video được render bằng TikTok Engine tự động.";
        const visualId = "laptop";
        
        console.log(`Narration: ${narration}`);
        console.log(`Visual ID: ${visualId}`);

        const resultPath = await renderTestScene(narration, visualId);
        
        if (fs.existsSync(resultPath)) {
            console.log(`[SUCCESS] Test scene generated at: ${resultPath}`);
        } else {
            console.error(`[ERROR] File was not created at ${resultPath}`);
        }
    } catch (e) {
        console.error("[CRITICAL ERROR] Test failed:", e);
    }
}

main();
