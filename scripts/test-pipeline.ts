import { scrapeArticle } from "../lib/scraper";
import { generateScript } from "../lib/ai";
import { renderVideo } from "../lib/video-renderer";

async function main() {
  console.log("Starting Full Pipeline Test...");
  try {
    // We already have a vnx.html file from the user. We can use it to mock scrape OR hit an actual tech URL:
    const url = "https://vnexpress.net/quan-doi-my-neu-muc-tieu-phong-toa-o-eo-bien-hormuz-5061565.html";
    console.log(`[1] Scraping: ${url}`);
    
    // MOCKING Scrape to save time during testing:
    const article = {
        title: "Quân đội Mỹ nêu mục tiêu phong tỏa ở eo biển Hormuz",
        content: "Mỹ phong tỏa eo biển Hormuz để ngăn chặn dòng chảy vũ khí đến lực lượng Houthi. Trọng tâm của bộ tư lệnh trung tâm không phải đối đầu quân sự toàn diện.",
        url: url
    };
    
    const script = await generateScript(article, {
        apiKey: process.env.AI_API_KEY || "",
        channelGoal: "tech",
        customPrompt: "Nhấn mạnh từ khoá quân sự."
    });
    
    console.log("[AI Script Result]:", JSON.stringify(script, null, 2));

    console.log("[3] Rendering Video ...");
    const jobId = `test_pipe_${Date.now()}`;
    const outputUrl = await renderVideo(script, "720p", jobId);
    
    console.log(`[SUCCESS] Full pipeline completed. Video at: ${outputUrl}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
        console.error("[CRITICAL ERROR] Pipeline failed:", error.message);
    } else {
        console.error("[CRITICAL ERROR] Pipeline failed:", error);
    }
  }
}

main();
