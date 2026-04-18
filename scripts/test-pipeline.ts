import { scrapeArticle } from "../lib/scraper";
import { generateScript } from "../lib/ai";
import { renderVideo } from "../lib/video-renderer";
import { generateSocialCards } from "../lib/social-card-generator";

async function main() {
  console.log("Starting Full Pipeline Test...");
  try {
    const url = "https://vnexpress.net/xuong-iran-tan-cong-tau-dau-o-eo-bien-hormuz-5064131.html";
    console.log(`[1] Mocking Article: ${url}`);
    
    // MOCKING Scrape to save time during testing:
    const article = {
        title: "Xuồng Iran tấn công tàu dầu ở eo biển Hormuz",
        content: "Xuồng của vệ binh Cách mạng Hồi giáo Iran nổ súng vào tàu chở dầu thương mại tại eo biển Hormuz, sau quyết định tái kiểm soát tuyến hàng hải huyết mạch.",
        url: url,
        imageUrls: [], // no images in mock; real scraper will populate these
    };
    
    console.log("[2] Generating Script...");
    const script = await generateScript(article, {
        apiKey: process.env.AI_API_KEY || "",
        channelGoal: "war",
        customPrompt: "Nhấn mạnh sự căng thẳng quân sự."
    });
    
    console.log("[AI Script Result]:", JSON.stringify(script, null, 2));

    console.log("[2.5] Generating Social Cards...");
    const socialCards = generateSocialCards(article, script);
    console.log(`[Social Cards Generated] Twitter: ${socialCards.twitterCardHtml.length} bytes, Comments: ${socialCards.commentsCardHtml.length} bytes`);

    console.log("[3] Rendering Video ...");
    const jobId = `test_pipe_${Date.now()}`;
    const outputUrl = await renderVideo(script, "720p", jobId, undefined, article.imageUrls, socialCards);
    
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
