# 🎬 News2Reel — Automated TikTok Video Generation Pipeline

> **Turn any news article into a viral TikTok video in under 2 minutes — fully automated.**

News2Reel is a production-ready, self-hosted pipeline that scrapes Vietnamese tech news (VNExpress, Dân Trí, etc.), rewrites it into a punchy TikTok script using AI, synthesizes voiceover via Microsoft Edge TTS, and renders a 1080×1920 vertical video with dynamic visual effects — all without touching a video editor.

---

## ✨ Features

### Core Pipeline
- [x] **Automated news scraping** — fetches and parses articles from configured sources (VNExpress, etc.)
- [x] **AI Script Generation** — LLM rewrites article into a fast-paced, hook-driven TikTok script with `<keyword>` tagging
- [x] **Multi-provider AI support** — Beeknoee (GPT-OSS-120B), Groq (LLaMA 3.3 70B), or any OpenAI-compatible endpoint
- [x] **Vietnamese TTS** — Microsoft Edge TTS (`vi-VN-NamMinhNeural`) at +20% speed for energetic pacing; Google TTS fallback
- [x] **FFmpeg video rendering** — pure FFmpeg `filter_complex` pipeline, no Remotion or browser dependency
- [x] **BGM layer** — background music mixed under voiceover at reduced volume

### Scene Type Engine (`lib/vfx-builder.ts`)
- [x] **`normal`** — Dark gradient background + 3D emoji icon (floating sine animation) + karaoke subtitle
- [x] **`counter`** — Giant red odometer counting up `0 → N` using FFmpeg expression evaluator (`min(max(t,0)/RAMP,1)*END`)
- [x] **`vs_screen`** — Side-by-side comparison boxes ("Human Response vs AI Speed") with colored backgrounds
- [x] **`terminal`** — macOS-style terminal window (traffic lights) with **character-by-character typewriter** at 0.05s per char
- [x] **`checklist`** — Staggered ✓ checklist lines appearing one-by-one using `enable='gte(t,X)'`
- [x] **`progress_bar`** — Animated horizontal bar with dynamic `drawbox` width expression filling to target%
- [ ] **`timeline`** — Vertical flow diagram with animated node connections (planned)
- [ ] **`split_image`** — Real article photo as left panel + text on right (planned)

### Subtitle Engine (`lib/vfx-subtitle.ts`)
- [x] **Word-by-word ASS karaoke** — each word appears timed to audio
- [x] **CapCut-style box highlight** — `BorderStyle=4` + `BackColour=&H99FF0055` (hot pink box behind current keyword)
- [x] **Bouncing pop-in animation** — words scale 0% → 120% → 100% on entry via ASS `\t()` transforms
- [x] **`<keyword>` tagging** — AI-marked important words get larger size + distinct box color
- [ ] **Character-level timing** — sync each char to exact TTS timestamp (planned, requires word-level audio alignment)

### Visual Effects
- [x] **Animated radial gradient** — `geq` filter with `sin(t)` color modulation creates "breathing" dark background
- [x] **Emoji icon floating** — sine-wave Y-axis motion `y='baseY + floor(15*sin(2*PI*t))'`
- [x] **Scene counter pill** — subtle `N/Total` progress text for retention
- [ ] **Matrix rain background** — falling Katakana chars (planned for hacker-theme articles)
- [ ] **Ken Burns effect** — scraped article images as background with slow zoom-pan

### Infrastructure
- [x] **Admin UI** — Next.js 15 dashboard to manage jobs, config, and trigger renders
- [x] **Job queue** — persistent job processor with `pending → processing → completed/failed` states
- [x] **Multi-quality output** — `ultrafast` / `fast` / `slow` FFmpeg presets via UI setting
- [x] **Video streaming API** — `/api/stream/videos/[filename]` for in-browser preview
- [x] **PM2 production deployment** — runs as a daemon on Ubuntu VPS with Nginx reverse proxy
- [ ] **TikTok auto-post** — direct upload via TikTok Content Posting API (API key wired, posting logic pending)
- [ ] **Scheduler** — cron-based daily video generation at configured times

---

## 🏗️ Architecture

```
Article URL
    │
    ▼
lib/scraper.ts          ← Cheerio HTML parsing, extracts title + body
    │
    ▼
lib/ai.ts               ← LLM rewrites to VideoScript JSON with scene_type fields
    │
    ▼
lib/tts.ts              ← Edge TTS → per-scene MP3 files
    │
    ▼
lib/video-renderer.ts   ← Orchestrates FFmpeg per scene, then concatenates
    │  └─► lib/vfx-builder.ts    ← Scene-type filter builders (counter, terminal, vs...)
    │  └─► lib/vfx-subtitle.ts   ← ASS karaoke subtitle generator
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

### Install & Run

```bash
git clone https://github.com/Konmeo22132-alt/News2Reel.git
cd News2Reel
npm install
cp .env.example .env   # fill in AI_API_KEY, etc.
npm run dev
```

Open [http://localhost:3069](http://localhost:3069) to access the admin panel.

### Production (Ubuntu VPS)

```bash
npm run build
pm2 start ecosystem.config.js --name autovideo-3069
```

---

## 🎬 Video Script JSON Schema

```jsonc
{
  "title": "Claude AI Đã Biết Viết EXPLOIT?",
  "hook": "AI vừa tự khai thác 22 lỗ hổng trong 2 tuần...",
  "scenes": [
    {
      "narration": "Claude đã viết <keyword>exploit</keyword> tự động",
      "duration": 6,
      "visual_id": "skull",
      "scene_type": "normal"
    },
    {
      "narration": "22 lỗ hổng bị khai thác",
      "duration": 5,
      "visual_id": "warning",
      "scene_type": "counter",
      "counter_end": 22,
      "counter_label": "lỗ hổng trong 2 tuần",
      "counter_suffix": ""
    },
    {
      "narration": "AI nhanh hơn con người",
      "duration": 6,
      "visual_id": "lightning",
      "scene_type": "vs_screen",
      "vs_left": "Human Response",
      "vs_right": "AI Speed"
    },
    {
      "narration": "Lệnh tấn công được chạy tự động",
      "duration": 7,
      "visual_id": "terminal",
      "scene_type": "terminal",
      "terminal_lines": ["> exploit --target CVE-2026-2796", "// Khai thác thành công..."]
    },
    {
      "narration": "Bảo vệ bản thân ngay hôm nay",
      "duration": 8,
      "visual_id": "shield",
      "scene_type": "checklist",
      "checklist_items": ["Update Firefox", "Bật Sandbox", "Cảnh giác Wasm"]
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

## 📁 Project Structure

```
lib/
├── ai.ts              # LLM script generator with scene_type prompting
├── scraper.ts         # Article fetcher & parser
├── tts.ts             # Edge TTS + Google TTS fallback
├── video-renderer.ts  # Main FFmpeg pipeline orchestrator
├── vfx-builder.ts     # Scene-type filter builders (spec-compliant)
├── vfx-subtitle.ts    # ASS karaoke subtitle generator
└── types.ts           # Shared TypeScript interfaces

app/
├── page.tsx           # Dashboard (job list + trigger)
├── actions/           # Server actions (config, jobs)
└── api/               # Streaming video API

scripts/
└── test-pipeline.ts   # End-to-end test runner
```

---

## 📄 License

MIT — free to use, modify, and deploy.
