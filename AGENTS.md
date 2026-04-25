<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AutoVideo Admin — Agent Context Document

> **Mục đích**: File này lưu lại toàn bộ kiến trúc, quy ước và trạng thái dự án để AI Agent (Antigravity/Gemini/Claude) có thể tiếp tục làm việc nhanh chóng mà không cần đọc lại toàn bộ code.
>
> **Cập nhật lần cuối**: 2026-04-25 (Session 3 — HOÀN TẤT TODO)

---

## 1. Tổng quan Dự án

**AutoVideo Admin** là một **Admin Panel** cho hệ thống tự động tạo video TikTok từ bài viết tin tức tiếng Việt.

### Pipeline chính:
```
URL bài viết → Scrape nội dung → DeepSeek AI viết kịch bản → Google TTS đọc → FFmpeg render video 9:16 → (Tùy chọn) Đăng TikTok
```

### Tech Stack:
| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Framework   | **Next.js 15.1.0** (App Router)               |
| Language    | **TypeScript**                                |
| Database    | **MongoDB** (Mongoose 9.4.1) — local hoặc Atlas |
| Styling     | **TailwindCSS 3.x** + Vanilla CSS (globals.css)|
| UI Icons    | **Lucide React**                              |
| UI Library  | **Radix UI** (label, select, separator, slot, switch, tabs, toast) |
| AI          | **Multi-Provider** (Beeknoee, Groq) via OpenAI-compatible API |
| TTS         | **Google Translate TTS** (free, no API key)   |
| Video       | **FFmpeg** (fluent-ffmpeg + ffmpeg-static)    |
| Scraping    | **Cheerio** + native fetch                    |
| Auth        | Cookie-based password (`ADMIN_PASSWORD`)      |

> ⚠️ **Prisma/SQLite legacy**: Prisma schema + dev.db vẫn còn trong repo nhưng **KHÔNG được sử dụng**. Đã migrate hoàn toàn sang MongoDB/Mongoose. Không thêm Prisma code mới.

---

## 2. Cấu trúc Thư mục

```
autovideo-admin/
├── app/
│   ├── layout.tsx              # Root layout (vi locale, import globals.css)
│   ├── page.tsx                # Redirect → /dashboard
│   ├── globals.css             # Design system: CSS variables, cards, badges, buttons, inputs, animations
│   ├── login/
│   │   └── page.tsx            # Client component, login form
│   ├── (app)/                  # Auth-protected route group
│   │   ├── layout.tsx          # Sidebar + main content layout
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Server component: stats cards, recent jobs table, CreateVideoForm
│   │   ├── history/
│   │   │   └── page.tsx        # Server component: full video job history table
│   │   └── settings/
│   │       └── page.tsx        # Server component → SettingsForm client component
│   ├── actions/
│   │   └── config.ts           # Server Actions: getConfig, updateConfig, getDashboardStats, getVideoHistory, getJobByJobId, countTodayJobs
│   └── api/
│       ├── auth/
│       │   ├── login/          # POST: set admin_token cookie
│       │   └── logout/         # POST: clear admin_token cookie
│       └── jobs/
│           ├── trigger/        # POST: create job + start pipeline (fire-and-forget)
│           ├── process/        # POST: internal pipeline execution
│           └── [id]/           # GET: job status by jobId
├── components/
│   ├── Sidebar.tsx             # Client: nav links (Dashboard, History, Settings), logout, mobile responsive
│   ├── CreateVideoForm.tsx     # Client: URL input → trigger API → poll job status
│   ├── SettingsForm.tsx        # Client: 3-tab form (AI & Render, TikTok, Strategy) + save server action
│   └── ClientDate.tsx          # Client: SSR-safe date formatter (vi-VN locale)
├── lib/
│   ├── mongodb.ts              # Mongoose connection singleton (survives hot-reload)
│   ├── types.ts                # Shared TS types: VideoJob, AppConfig, ScrapedArticle, VideoScript, ScriptScene, JobResult
│   ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│   ├── models/
│   │   ├── AppConfig.ts        # Mongoose model — singleton config doc (collection: app_config)
│   │   └── VideoJob.ts         # Mongoose model — video jobs (collection: video_jobs), indexed: createdAt, status, jobId
│   ├── ai.ts                   # AI Script generator: article → VideoScript JSON (pure storytelling narrative)
│   ├── scraper.ts              # HTML scraper: URL → {title, content, images}
│   ├── tts.ts                  # TTS Engine: text → MP3
│   ├── social-card-generator.ts# HTML/Tailwind generator for Twitter Cards and VNExpress Comments
│   ├── playwright-screenshot.ts# Headless Chromium engine converting HTML UI to transparent PNGs
│   ├── video-renderer.ts       # FFmpeg Orchestrator: Ken Burns Article Image + Playwright Overlays + Subtitles
│   ├── vfx-subtitle.ts         # ASS subtitle generator + animated gradient background filter
│   ├── tiktok.ts               # TikTok Content Posting API: init upload → PUT file → poll status
│   └── job-processor.ts        # Pipeline orchestrator: scrape → AI → render → tiktok(optional)
├── middleware.ts               # Auth guard: redirect to /login if no valid admin_token cookie
├── prisma/                     # ⚠️ LEGACY — not used, kept for reference
│   └── schema.prisma           # SQLite schema (AppConfig + VideoJob)
├── .env                        # MONGODB_URI, ADMIN_PASSWORD, (legacy DATABASE_URL)
└── next.config.ts              # serverExternalPackages: mongoose, ffmpeg, cheerio, prisma (legacy)
```

---

## 3. Database (MongoDB)

### Collections:

#### `app_config` — Singleton (1 document)
| Field             | Type    | Default      | Notes                           |
|-------------------|---------|--------------|---------------------------------|
| deepseekApiKey    | String? | null         | Legacy field for AI key         |
| aiProvider        | String  | "beeknoee"   | "beeknoee" or "groq"            |
| aiApiKey          | String? | null         | Active AI API key               |
| aiModel           | String? | null         | Active AI model override        |
| videoQuality      | String  | "720p"       | "720p" or "1080p"               |
| dailyVideoLimit   | Number  | 10           | Max videos per day              |
| newsSources       | String  | "[]"         | JSON array of URLs              |
| channelGoal       | String  | "ads"        | "ads" / "affiliate" / "branding"|
| tiktokApiKey      | String? | null         | TikTok developer app key        |
| tiktokApiSecret   | String? | null         | TikTok developer app secret     |
| autoPostEnabled   | Boolean | false        | Auto-post to TikTok after render|
| customPrompt      | String? | null         | Custom AI prompt rules          |
| updatedAt         | Date    | auto         | Mongoose timestamps             |

#### `video_jobs` — One per video task
| Field       | Type      | Default   | Notes                          |
|-------------|-----------|-----------|--------------------------------|
| jobId       | String    | uuid      | Unique, indexed                |
| sourceUrl   | String    | required  | Article URL                    |
| status      | String    | "pending" | pending/processing/completed/failed |
| resultUrl   | String?   | null      | `/videos/video_<jobId>.mp4`    |
| currentStep | String    | "Đang khởi tạo" | Pipeline step (e.g., Scrape bài viết) |
| logs        | String[]  | `[]`      | Real-time pipeline console logs|
| errorDetails| String?   | null      | Detail error msg if failed     |
| createdAt   | Date      | auto      | Indexed descending             |
| completedAt | Date?     | null      | Set on completed/failed        |

---

## 4. Authentication

- **Simple password-based** auth: Compare cookie `admin_token` with env `ADMIN_PASSWORD`
- Middleware (`middleware.ts`) protects all routes except `/login`, `/api/auth/*`, `/_next/*`, `/favicon.ico`
- Login: `POST /api/auth/login` → sets cookie → redirect to `/dashboard`
- Logout: `POST /api/auth/logout` → clears cookie → redirect to `/login`

---

## 5. API Routes

| Method | Path                 | Description                                    |
|--------|----------------------|------------------------------------------------|
| POST   | `/api/auth/login`    | Authenticate with password, set cookie         |
| POST   | `/api/auth/logout`   | Clear auth cookie                              |
| POST   | `/api/jobs/trigger`  | Create VideoJob + fire-and-forget pipeline      |
| POST   | `/api/jobs/process`  | Internal: execute pipeline for a job            |
| GET    | `/api/jobs/[id]`     | Get job status by jobId                        |

---

## 6. Server Actions (`app/actions/config.ts`)

| Function          | Description                              |
|-------------------|------------------------------------------|
| `getConfig()`     | Get singleton AppConfig (auto-create if none) |
| `updateConfig(data)` | Upsert config, revalidate /settings + /dashboard |
| `getDashboardStats()` | Returns config + todayCompleted + recentJobs + dailyUsage |
| `getVideoHistory(page, limit)` | Paginated video jobs list      |
| `getJobByJobId(jobId)` | Find one job by jobId                |
| `countTodayJobs()` | Count jobs created today                 |

---

## 7. Design System (`globals.css`)

### CSS Variables (Dark theme only):
```css
--bg: #0d0d14          --surface: #111118
--surface-2: #16161f   --surface-3: #1c1c28
--border: rgba(255,255,255,0.07)
--text-primary: #f0efff  --text-secondary: #9092a8  --text-muted: #50526a
--accent: #6366f1 (indigo)
--success: #10b981  --warning: #f59e0b  --danger: #ef4444  --info: #06b6d4
```

### CSS Classes:
- `.card` — surface bg + border + rounded-12px + hover border glow
- `.gradient-text` — indigo→purple text gradient
- `.badge` + variants: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral`
- `.input` — styled form input with focus glow
- `.btn` + variants: `.btn-primary`, `.btn-ghost`, `.btn-danger`
- Animations: `.fade-up`, `.spin`, `.pulse-anim`
- `.dotted-bg` — subtle dot grid background (login page)

### Font: Inter (Google Fonts, weights 300-700)

---

## 8. Video Pipeline Chi tiết

1. **Scraper** (`lib/scraper.ts`): Fetch HTML → cheerio parse → extract title + content (content selectors priority list). Selector specific to sites like VNExpress (`.fck_detail`, `.sidebar-1`), etc.
2. **AI** (`lib/ai.ts`): Send article to AI API (Beeknoee/Groq) → structured JSON response (title, hook, 5 scenes, CTA). AI viết narration với thẻ `<keyword>` để highlight từ quan trọng. Fallback auto-repair if JSON fields are missing (e.g. model ignores `response_format`).
3. **TTS** (`lib/tts.ts`): Split narration → Google Translate TTS chunks (≤180 chars each) → concatenate MP3. Dùng edge-tts làm primary (higher quality), fallback về Google TTS.
4. **Renderer** (`lib/video-renderer.ts`): **5-Layer Retention Architecture**:
   - **Layer 1**: Animated Gradient Background — geq filter với time-based sin/cos pulse (breathing effect)
   - **Layer 2**: Dynamic Icon — PNG icon pop-in entrance (scale 0→1) + floating sine wave (`y=baseY+floor(15*sin(2πt))`)
   - **Layer 3**: Scene Counter — drawtext hiển thị scene index
   - **Layer 4**: Bouncing Karaoke Subtitles — ASS file với word-by-word animation (scale 0%→120%→100%→0%)
   - **Layer 5**: BGM Audio — nhạc nền epic/synthwave (tùy chọn, tự động tìm trong `public/assets/bgm/`)
   
   Each scene: TTS audio → ffprobe duration → ASS karaoke → FFmpeg filter_complex → concat segments. Output: 1080x1920 (9:16), 30fps, CRF 17-20, MP4 in `public/videos/`. Sử dụng system `ffmpeg` để đảm bảo `lavfi` + `geq` filter hoạt động.
5. **TikTok** (`lib/tiktok.ts`): (Optional) Init upload → PUT file → poll status. Requires OAuth access_token.

### Retention Boosters (Video v2):
- **Bouncing Karaoke**: Mỗi từ xuất hiện với scale animation, keyword được highlight vàng với scale 130%
- **Dynamic Icons**: Icons lơ lửng tạo "sức sống" cho khung hình tĩnh
- **Animated Gradient**: Background "thở" với brightness pulse, không còn đứng im
- **BGM Layer**: Nhạc nền lấp đầy khoảng lặng, tăng engagement

---

## 9. Quy ước Code

- **Ngôn ngữ UI**: Tiếng Việt
- **Server Components**: Dashboard page, History page, Settings page (fetch data server-side)
- **Client Components**: Marked with `"use client"` — Sidebar, CreateVideoForm, SettingsForm, ClientDate
- **Date rendering**: Always use `<ClientDate>` component to avoid SSR hydration mismatch
- **MongoDB connection**: Always call `await connectDB()` before any Mongoose operation
- **Mongoose models**: Check `mongoose.models["ModelName"]` before calling `mongoose.model()` (hot-reload safe)
- **Video output**: Saved to `public/videos/video_<jobId>.mp4`, served as `/videos/<filename>`
- **Temp files**: Use `os.tmpdir()` for intermediate TTS/FFmpeg files, cleanup in `finally` block

---

## 10. Environment Variables

```env
MONGODB_URI="mongodb://localhost:27017/autovideo"    # Required
ADMIN_PASSWORD="admin"                                # Required (change in production!)
DATABASE_URL="file:./prisma/dev.db"                   # Legacy, unused
```

---

## 11. Chạy dự án

```bash
# Install
npm install

# Start MongoDB (local)
mongod

# Dev server
npm run dev        # → http://localhost:3000

# Login: password = giá trị ADMIN_PASSWORD trong .env
```

### 🚀 Deploy lên VPS (One-shot command)

```bash
cd /var/www/News2Reel && git fetch origin && git reset --hard origin/main && rm -rf .next && npm run build && pm2 restart autovideo-3069
```

- **Repo path**: `/var/www/News2Reel`
- **PM2 app name**: `autovideo-3069`
- **Port**: `3069`
- **Domain**: `video.konmeo22132.dev` (Nginx reverse proxy)

---

## 12. Remotion — Layout Zone System

```
Frame: 1080 x 1920px
┌─────────────────────┐ 0px
│   TOP ZONE (280px)  │ ← Breaking news banner, watermark (@channel)
├─────────────────────┤ 280px
│                     │
│  CONTENT ZONE       │ ← NewsPhoto (CLIPPED HERE), animation overlays
│  (1160px)           │   ImpactCallout, SocialTweet, DataChart, v.v.
│                     │
├─────────────────────┤ 1440px  ← CONTENT_MAX_BOTTOM
│  SUBTITLE ZONE      │ ← KaraokeSubtitle ONLY — SACRED, nothing else
│  (480px)            │   Semi-transparent bar, 4-word karaoke
└─────────────────────┘ 1920px
```

**File constants**: `remotion/constants/layout.ts` — import `ZONES`, `FONT_SIZES`, `ANIM`

**Rule**: Mọi component PHẢI respect zone của mình. ContentZone có `overflow: hidden` hard clip.

---

## 13. Trạng thái & Ghi chú

### Đã hoàn thành ✅:
- [x] MongoDB migration (từ SQLite/Prisma)
- [x] Auth system (login/logout/middleware)
- [x] Dashboard page (stats, recent jobs, create video form)
- [x] History page (full job list)
- [x] Settings page (3-tab: AI, TikTok, Strategy)
- [x] Full pipeline: Scrape → AI → TTS → FFmpeg → TikTok
- [x] Dark theme design system
- [x] SSR-safe date rendering (ClientDate component)
- [x] Mobile responsive sidebar
- [x] Vision AI: multimodal + auto-fallback text-only nếu 400
- [x] Scraper v2: extract tất cả ảnh (lazy-load, figure, OG meta)
- [x] Remotion Layout Zone System: TopZone/ContentZone/SubtitleZone
- [x] KaraokeSubtitle: 4-word group, word-level highlight, bottom zone cố định
- [x] FFmpeg v3: Ken Burns, BGM -18dB, watermark, Breaking News lower-third, xfade transition
- [x] B-Roll seamless loop: `setpts=PTS-STARTPTS` + `fps=30` + `shortest=1`
- [x] **HyperFrames Engine**: HTML/GSAP render → headless Chrome → FFmpeg mux
- [x] **Video preview inline**: `<video>` player trong CreateVideoForm khi render xong
- [x] **Settings validation**: validate API key + "Test kết nối" button live
- [x] **Cron endpoint**: `POST /api/cron/auto-generate` Bearer auth + daily limit guard
- [x] **Cross-dissolve**: xfade 0.25s giữa scenes (FFmpeg), fallback plain concat

### Cần lưu ý ⚠️:
- Prisma/SQLite files vẫn còn (legacy) — KHÔNG sử dụng, có thể xóa
- TikTok auto-post cần OAuth access_token (chưa có OAuth flow UI)
- Google TTS có thể bị rate-limit nếu tạo nhiều video liên tục
- FFmpeg: Bắt buộc trên VPS (`apt install ffmpeg`) để dùng `lavfi`, `zoompan`, `xfade`, `geq`
- `zoompan` chậm trên CPU yếu — cân nhắc skip nếu VPS low-spec
- HyperFrames: cần `npx playwright install chromium` trên VPS trước khi dùng
- Vision API chỉ hoạt động với model multimodal — text-only auto-fallback
- **Node.js 22+ bắt buộc** cho HyperFrames CLI

### TODO / Planned:
- [ ] TikTok OAuth flow UI (high priority)
- [ ] Bulk video creation (queue n nhiều URL một lúc)
- [ ] Analytics dashboard (view counts, completion rate)
- [ ] Test HyperFrames trên VPS Ubuntu thực tế

---

## 14. Changelog

| Ngày       | Thay đổi |
|------------|----------|
| 2026-04-25 | **Session 3 — HOÀN TẤT TODO**: B-Roll seamless loop (`setpts+fps=30+shortest`). Breaking News lower-third trong FFmpeg (BREAKING red box + title fade). Cron endpoint `POST /api/cron/auto-generate` (Bearer auth, daily limit). `.env.example` cập nhật `CRON_SECRET`, `FFMPEG_PATH`. README + AGENTS.md đầy đủ. Git push. |
| 2026-04-25 | **Session 2 — HyperFrames + UI**: HyperFrames Engine (HTML/GSAP, `@hyperframes/core`). Inline video preview khi render xong. Settings validation + Test kết nối. `/api/test-ai-connection`. Cross-dissolve xfade 0.25s. |
| 2026-04-25 | **Session 1 — Layout + Subtitle**: Remotion Layout Zone System (`layout.ts`). KaraokeSubtitle 4-word group. FFmpeg v3: Ken Burns, BGM -18dB, watermark. AI Vision fallback. Scraper v2. |
| 2026-04-16 | **Video Renderer v2**: Bouncing Karaoke subtitles, Dynamic Icon, Animated Gradient, BGM/SFX layer. Real-time Pipeline UI (logs, currentStep, errorDetails). |
| 2026-04-16 | Fix pipeline: Scraper VNExpress, Multi-provider AI, JSON repair, Prefer System FFmpeg. |
| 2026-04-15 | Tạo AGENTS.md. Migrate AI từ Claude sang Beeknoee. |
| 2026-04-11 | Migrate từ SQLite/Prisma sang MongoDB/Mongoose. Fix hydration errors. |
| 2026-04-08 | Khởi tạo dự án AutoVideo Admin Panel. |
