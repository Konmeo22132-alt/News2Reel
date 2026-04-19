# 🎬 News2Reel — Automated TikTok Video Generation Pipeline

> **Turn any news article into a viral TikTok video in under 2 minutes — fully automated.**

News2Reel is a production-ready, self-hosted pipeline that scrapes Vietnamese tech and general news (VNExpress, Dân Trí, etc.), rewrites it into a punchy TikTok script using AI, synthesizes voiceover via Microsoft Edge TTS, and renders a 1080×1920 vertical video using a **modern Hybrid Architecture (Playwright HTML/Tailwind UIs + FFmpeg Compositing)** — all without touching a video editor.

---

## ✨ Features

### Core Pipeline
- [x] **Automated news scraping** — fetches and parses articles from configured sources (VNExpress, etc.) including high-res article imagery.
- [x] **AI Script Generation** — LLM rewrites article into a fast-paced, hook-driven TikTok script with `<keyword>` tagging for emphasis.
- [x] **Multi-provider AI support** — Beeknoee (GPT-OSS-120B), Groq (LLaMA 3.3 70B), or any OpenAI-compatible endpoint.
- [x] **Vietnamese TTS** — Microsoft Edge TTS (`vi-VN-NamMinhNeural`) at +20% speed for energetic pacing; Google TTS fallback.
- [x] **Hybrid Video Rendering** — Combine high fidelity React/Tailwind UIs overlaid perfectly on FFmpeg-rendered video streams.

### High-Fidelity UI Engine (`lib/social-card-generator.ts` + Playwright)
- [x] **Twitter/X Dark Mode Hooks** — Automatically formats the title and news publisher into a hyper-realistic Twitter-style UI to capture attention.
- [x] **Dynamic VNExpress Comments** — Simulates realistic multi-faceted comments (Pro/Con/Analytical) with high engagement stats for the CTA screen.
- [x] **Deterministic Theming** — Maps 7 different news categories (War, Tech, Economy, Crime, Politics, Disaster) to specific color palettes and warning badges.

### Subtitle & Compositing Engine (`lib/video-renderer.ts`, `lib/vfx-subtitle.ts`)
- [x] **Vertical B-Roll Loop** — Intelligently loops high-quality serious stock footage (`public/assets/broll/serious_loop.mp4`) wrapped in heavy box blur for professional scene setting.
- [x] **Elegant Dark Fallback** — Replaces chaotic backgrounds with deep Charcoal / Midnight Blue animated gradient meshes if B-Roll is missing.
- [x] **Smooth UI Slide-up** — Playwright social cards animate into view with cinematic easing algorithms via native FFmpeg math evaluation.
- [x] **Word-by-word ASS karaoke** — CapCut-style box highlight (`BorderStyle=4` + `BackColour=&H99FF0055`) with each word scaling 0% → 120% → 100% on entry.

### Infrastructure
- [x] **Admin UI** — Next.js 15 dashboard to manage jobs, config, and trigger renders.
- [x] **Multi-quality output** — `ultrafast` / `fast` / `slow` FFmpeg presets via UI setting.
- [x] **Video streaming API** — `/api/stream/videos/[filename]` for in-browser preview.
- [x] **PM2 production deployment** — runs as a daemon on Ubuntu VPS with Nginx reverse proxy.
- [ ] **TikTok auto-post** — direct upload via TikTok Content Posting API (API key wired, posting logic pending).

---

## 🏗️ Architecture

```
Article URL
    │
    ▼
lib/scraper.ts          ← Cheerio HTML parsing, extracts title + body + imagery
    │
    ▼
lib/ai.ts               ← LLM Hook-Driven Storytelling (Serious Journalism paradigm)
    │
    ▼
lib/social-card-generator.ts ← Deterministically maps fake_username + context_image_index into HTML/Tailwind templates
lib/playwright-screenshot.ts ← Renders precise transparent PNG overlays of UIs
    │
    ▼
lib/tts.ts              ← Edge TTS → per-scene MP3 files
    │
    ▼
lib/video-renderer.ts   ← Orchestrates FFmpeg: Looping B-Roll BG + Cinematic Slide-up + ASS karaoke
    │
    ▼
public/videos/video_<jobId>.mp4
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3 + `pip install edge-tts`
- FFmpeg 6+ on PATH (with `libass`, `libfreetype` support)
- Playwright Chromium dependencies

### Install & Run

```bash
git clone https://github.com/Konmeo22132-alt/News2Reel.git
cd News2Reel
npm install
npx playwright install chromium --with-deps
cp .env.example .env   # fill in AI_API_KEY, etc.
npm run dev
```

Open [http://localhost:3069](http://localhost:3069) to access the admin panel.

---

## 🎬 Video Script JSON Schema

The LLM is now purely trained as an investigative journalist, dropping Wikipedia-style bullet points in favor of high-retention hook-driven storytelling.

```jsonc
{
  "clickbait_title": "Rạp xiếc 1.400 tỷ: Sự lãng phí hay bước lùi?",
  "fake_username": "The Investigator",
  "hook": "Liệu rạp xiếc 1.400 tỷ đồng này là sự lãng phí tiền thuế khổng lồ?",
  "scenes": [
    {
      "narration": "Thay vì đọc các thông số nhàm chán, chúng ta hãy nhìn vào mặt khuất mảng tối đằng sau <keyword>hàng nghìn tỷ đồng</keyword> đang được huy động này.",
      "duration": 6,
      "context_image_index": 0
    },
    {
      "narration": "Người dân ngả ngửa trước tốc độ phê duyệt, đây là con số mà không ai có thể ngờ tới.",
      "duration": 7,
      "context_image_index": 1
    }
  ],
  "callToAction": "Theo dõi để không bỏ lỡ diễn biến tiếp theo!"
}
```

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AI_BASE_URL` | OpenAI-compatible API base URL | Beeknoee platform |
| `AI_MODEL` | Model name override | Provider default |
| `DATABASE_URL` | SQLite DB path | `./prisma/dev.db` |

---

## 📄 License

MIT — free to use, modify, and deploy.
