# 🎬 News2Reel — Automated TikTok Video Generation Pipeline

> **Turn any news article into a viral TikTok video in under 2 minutes — fully automated.**

News2Reel is a production-ready, self-hosted pipeline that scrapes Vietnamese tech and general news (VNExpress, Dân Trí, etc.), rewrites it into a punchy TikTok script using AI, synthesizes voiceover via Microsoft Edge TTS, and renders a 1080×1920 vertical video using a **modern Hybrid Architecture: Dual-Engine FFmpeg Compositing & React/Remotion Rendering** — all without touching a video editor.

---

## ✨ Features

### Core Pipeline
- [x] **Automated news scraping** — fetches and parses articles from configured sources (VNExpress, etc.) including high-res article imagery.
- [x] **AI Script Generation** — LLM rewrites article into a fast-paced, hook-driven TikTok script with `<keyword>` tagging for emphasis.
- [x] **Multi-provider AI support** — Beeknoee (GPT-OSS-120B), Groq (LLaMA 3.3 70B), or any OpenAI-compatible endpoint.
- [x] **Vietnamese TTS** — Microsoft Edge TTS (`vi-VN-NamMinhNeural`) at +20% speed for energetic pacing; Google TTS fallback.
- [x] **Dual Rendering Engines** — Switch seamlessly between Fast FFmpeg Compositing and High-Fidelity Remotion React Timelines depending on VPS restrictions.

### Option 2: Remotion React Engine (5-Layer Architecture)
The newly integrated **Prop-Driven Remotion Engine** completely replaces FFmpeg strings with fluid React math:
- **Layer 1 (Audio)**: Multi-track `<Audio>` orchestration syncing TTS files and BGM flawlessly.
- **Layer 2 (Ken Burns Background)**: Dynamic CSS panning and zooming on scraped article images (`NewsPhoto`).
- **Layer 3 (Social Components)**: Embed Twitter or Hacker Terminal outputs programmatically using JSON scripts.
- **Layer 4 (Karaoke Bouncing)**: Replicates the `vfx-subtitle.ts` algorithm natively in React-Spring. Split text parsing perfectly aligns to `durationInFrames` to scale `120%` word-by-word.

### Option 1: Legacy FFmpeg Engine
- [x] **Vertical B-Roll Loop** — Intelligently loops high-quality serious stock footage.
- [x] **Smooth UI Slide-up** — Playwright social cards animate into view with cinematic easing algorithms via native FFmpeg math evaluation.
- [x] **Word-by-word ASS karaoke** — CapCut-style box highlight.

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
lib/job-processor.ts    ← Routes payload to either FFmpeg or Remotion based on user Dashboard choice
    │
    ▼    
(Option 1) FFmpeg Engine         (Option 2) Remotion Engine
lib/video-renderer       OR      lib/video-renderer-remotion.ts (React Webpack Bundler)
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
- Playwright Chromium dependencies (if using Option 1)

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

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AI_BASE_URL` | OpenAI-compatible API base URL | Beeknoee platform |
| `AI_MODEL` | Model name override | Provider default |
| `DATABASE_URL` | SQLite DB path | `./prisma/dev.db` |

---

## 📄 License

MIT — free to use, modify, and deploy.
