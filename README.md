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

### Subtitle & VFX Engine (`lib/vfx-subtitle.ts`)
- [x] **Background Article Images** — Ken Burns full-screen slow zoom-pan on the original scraped article imagery.
- [x] **Word-by-word ASS karaoke** — each word appears timed to audio.
- [x] **CapCut-style box highlight** — `BorderStyle=4` + `BackColour=&H99FF0055` (hot pink box behind current keyword).
- [x] **Bouncing pop-in animation** — words scale 0% → 120% → 100% on entry via ASS `\t()` transforms.
- [x] **Animated radial gradient** — `geq` filter with `sin(t)` color modulation creates "breathing" dark background.

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
lib/ai.ts               ← LLM rewrites to VideoScript JSON (pure narration focus)
    │
    ▼
lib/social-card-generator.ts ← Deterministically injects content into HTML/Tailwind templates
lib/playwright-screenshot.ts ← Renders precise transparent PNG overlays of UIs
    │
    ▼
lib/tts.ts              ← Edge TTS → per-scene MP3 files
    │
    ▼
lib/video-renderer.ts   ← Orchestrates FFmpeg: Ken Burns BG + Playwright overlays + ASS karaoke
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

The LLM is now purely trained to be a narrative storyteller, dropping complex legacy FFmpeg parameters.

```jsonc
{
  "title": "Claude AI Đã Biết Viết EXPLOIT?",
  "hook": "AI vừa tự khai thác 22 lỗ hổng trong 2 tuần...",
  "scenes": [
    {
      "narration": "Claude đã viết <keyword>exploit</keyword> tự động. 22 lỗ hổng bị khai thác hoàn toàn tự động.",
      "duration": 6,
      "visual_id": "skull",
      "image_index": 0
    },
    {
      "narration": "Lệnh tấn công được chạy tự động, đây là tốc độ mà con người không thể theo kịp.",
      "duration": 7,
      "visual_id": "terminal",
      "image_index": 1
    }
  ],
  "callToAction": "Follow để cập nhật tin tức bảo mật mỗi ngày!"
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
