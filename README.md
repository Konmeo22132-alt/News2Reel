# 🎬 News2Reel — Automated TikTok Video Generation Pipeline

> **Turn any news article into a viral TikTok video in under 2 minutes — fully automated.**

News2Reel là pipeline tự động hóa production-ready, self-hosted: scrape tin tức Việt Nam, rewrite bằng AI thành TikTok script, tổng hợp TTS giọng nói, và render video 1080×1920 qua **Triple-Engine Architecture**: FFmpeg, Remotion (React), và HyperFrames (HTML/GSAP).

---

## ✨ Features

### Core Pipeline
- [x] **Automated news scraping v2** — extracts article body + ALL images (lazy-load, OG meta, figure tags) with UTM param cleaning.
- [x] **AI Script Generation + Vision** — LLM rewrites article into hook-driven TikTok script with `<keyword>` tagging; sends article images (up to 5) for AI to choose scene-appropriate photos. Auto-fallback to text-only if model doesn't support vision.
- [x] **Multi-provider AI support** — Beeknoee (GPT-OSS-120B), Groq (LLaMA 3.3 70B), or any OpenAI-compatible endpoint.
- [x] **Vietnamese TTS** — Microsoft Edge TTS (`vi-VN-NamMinhNeural`) at +20% speed; Google TTS fallback.
- [x] **Triple Rendering Engines** — FFmpeg (fast), Remotion React (HQ viral), HyperFrames HTML/GSAP (cinematic).
- [x] **Cron Auto-Generation** — `POST /api/cron/auto-generate` với Bearer auth + daily limit guard.

### 🌐 Option 3: HyperFrames Engine — HTML/GSAP (Cinematic)
HyperFrames renders thông qua headless Chrome → FFmpeg MP4:
- **Ken Burns**: GSAP `fromTo` scale 1.0→1.08 + pan suốt duration scene.
- **4-word Karaoke**: GSAP className toggle — active=white/gold, past=gray, future=dark. Không bounce.
- **Breaking News Banner**: GSAP slide-in từ `-60px` → `0` trong 0.5s (hook scenes).
- **Animation Overlays**: `ImpactCallout` (big number), `DataChart` (bar chart animate), `SplitScreenVS`, `WarningAlert`.
- Render: `npx hyperframes render --input scene.html --output scene.mp4 --fps 30`
- Mux audio + concat: FFmpeg sau khi render từng scene.

### ⚛️ Option 2: Remotion React Engine — Layout Zone Architecture
Strict 3-zone layout system (1080×1920):
- **Top Zone (0-280px)**: Breaking news banner + channel watermark.
- **Content Zone (280-1440px)**: `NewsPhoto` Ken Burns image (hard-clipped), animation overlays.
- **Subtitle Zone (1440-1920px)**: `KaraokeSubtitle` ONLY — sacred, nothing else.

### ⚡ Option 1: FFmpeg Engine v3
- [x] **Breaking News lower-third** — `BREAKING` red box + animated title text, fade out sau 2.5s (hook scenes).
- [x] **Article image with Ken Burns** — `zoompan` zoom 1.0→1.08, crop 9:16.
- [x] **Seamless B-Roll Loop** — `setpts=PTS-STARTPTS` reset timestamps, `fps=30` để tránh giật khi loop.
- [x] **BGM at -18dB** — `amix` weight 0.12.
- [x] **Watermark** — `@News2Reel` top-left, 55% opacity.
- [x] **4-word karaoke subtitles** — active word white/yellow, unspoken gray.
- [x] **Cross-dissolve transitions** — `xfade=fade:0.25s` giữa scenes, fallback plain concat.

### 🏗️ Infrastructure
- [x] **Admin UI** — Next.js 15 dashboard: manage jobs, config, trigger renders.
- [x] **Inline video preview** — `<video>` player ngay trong form khi render xong (autoPlay, muted, loop).
- [x] **Settings validation** — validate API key trước khi save, "Test kết nối" button verify live.
- [x] **Multi-quality output** — 720p (fast) / 1080p (HQ).
- [x] **Video streaming API** — `/api/stream/videos/[filename]` for in-browser preview.
- [x] **Cron endpoint** — `/api/cron/auto-generate` với Bearer secret auth + daily limit check.
- [ ] **TikTok auto-post** — direct upload via TikTok Content Posting API (wired, auth pending).

---

## 🏗️ Architecture

```
Article URL
    │
    ▼
lib/scraper.ts              ← Cheerio parsing: title + body + ALL images (OG/lazy/figure)
    │
    ▼
lib/ai.ts                   ← Vision LLM: multimodal image+text, auto-fallback text-only
    │
    ▼
lib/job-processor.ts        ← Routes to engine based on UI choice
    │
    ├── engine="ffmpeg"      → lib/video-renderer.ts
    │       └── TTS → Ken Burns → Breaking News L3 → ASS Karaoke → Watermark → xfade concat
    │
    ├── engine="remotion"    → lib/video-renderer-remotion.ts
    │       └── React zones: TopZone / ContentZone / SubtitleZone
    │
    └── engine="hyperframes" → lib/video-renderer-hyperframes.ts
            └── HTML template → GSAP animate → HF render → FFmpeg mux → concat
    │
    ▼
public/videos/video_<jobId>.mp4
    │
    ▼
/api/cron/auto-generate     ← Cron trigger (Bearer auth, daily limit guard)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+** (required by HyperFrames)
- **Python 3** + `pip install edge-tts`
- **FFmpeg 4.3+** on PATH (with `libass`, `libfreetype`, `xfade` support)
- **Playwright Chromium** (cho HyperFrames headless render và social card screenshots)

### Install & Run

```bash
git clone https://github.com/Konmeo22132-alt/News2Reel.git
cd News2Reel
npm install
npx playwright install chromium --with-deps
cp .env.example .env   # fill in MONGODB_URI, ADMIN_PASSWORD, etc.
npm run dev
```

Open [http://localhost:3069](http://localhost:3069) to access the admin panel.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/autovideo` |
| `ADMIN_PASSWORD` | Admin panel password | `admin` |
| `CRON_SECRET` | Bearer token cho `/api/cron/auto-generate` | disabled if not set |
| `FFMPEG_PATH` | Override FFmpeg binary path | `ffmpeg` (from PATH) |

API Keys và cấu hình AI được lưu trong MongoDB qua Settings UI — không cần biến môi trường riêng.

---

## 🤖 Cron Auto-Generation

Set up cron trên VPS Ubuntu:

```bash
# Tạo video mỗi 4 giờ
0 */4 * * * curl -s -X POST http://localhost:3069/api/cron/auto-generate \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"engine": "ffmpeg"}' >> /var/log/news2reel-cron.log 2>&1
```

Xem trạng thái: `GET /api/cron/auto-generate` (không cần auth).

---

## 📄 License

MIT — free to use, modify, and deploy.
