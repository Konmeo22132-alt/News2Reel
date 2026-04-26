# 🎬 News2Reel

**News2Reel** is a fully automated pipeline designed to transform a news article URL into a high-quality, cinematic short video (Shorts/TikTok/Reels). It is highly optimized to retain viewer attention with fast-paced storytelling and engaging visual designs.

## ✨ Key Features

- **100% Automated:** Simply input a news article URL, and the system handles scraping, scriptwriting, voiceover generation, and video rendering.
- **Multi-Agent AI:**
  - **Script Agent:** Generates sensational hooks, segments the script into scenes, and triggers visual effects automatically (supports Groq, OpenAI, and compatible APIs).
  - **Vision Agent (Optional):** Analyzes actual images from the article to ensure the script context perfectly matches the visuals.
- **Modern Render Engine:** Utilizes React/Web technologies (via Remotion) for complex, programmable video effects:
  - **Cinematic Hook:** The first 3 seconds use a combination of white flashes, camera shakes, zoom bursts, and title slams to "stop the scroll."
  - **Dynamic Subtitles:** Karaoke-style subtitles with dynamic scaling and glowing effects on important keywords.
  - **Scene Transitions:** Cinematic transitions including zoom-through, glitch cuts, whip pans, and cross-fades.
  - **Post-processing:** Built-in color grading, contrast enhancement, and vignette effects.
- **Optimized for Headless VPS:** The rendering engine is specifically tuned to run smoothly on low-spec VPS environments (2GB - 4GB RAM) without physical GPUs. Features effective anti-hang and Out-Of-Memory (OOM) killer prevention.
- **High-Quality Voiceovers:** Utilizes Microsoft Edge TTS for natural-sounding, dynamic AI voices.

## 🚀 Installation & Setup

### System Requirements
- Node.js >= 18
- PM2 (recommended for production)
- FFmpeg (required for audio and video post-processing)
- Recommended VPS: Ubuntu, >= 4GB RAM (or 2GB RAM + Swap).

### Setup Instructions

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repo-url>
   cd autovideo-admin
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` file based on `.env.example` and fill in the required API keys (MongoDB, AI Provider, etc.).

3. **Configure Swap Space (Critical for low-RAM VPS):**
   If running on a VPS with limited memory, execute the setup script to create swap space, preventing OOM crashes during rendering.
   ```bash
   chmod +x scripts/setup-swap.sh
   sudo ./scripts/setup-swap.sh
   ```

### Running in Development
```bash
npm run dev
```

### Running in Production
It is highly recommended to use PM2 to manage the application process and prevent system crashes during heavy rendering tasks.
```bash
npm run build
pm2 startOrRestart ecosystem.config.js
pm2 save
```

## 🏗 Project Structure

- `/app`: Next.js App Router containing the Admin Dashboard UI and API endpoints.
- `/lib`: Core logic including Scraper, AI Agents, Job Processor, and Database Models.
- `/remotion`: React source code for video generation (Compositions, Components, Layout constants).
- `/public`: Storage for static assets and successfully rendered videos.
- `/scripts`: Utility scripts for system setup and maintenance.

## 📝 License
Proprietary / Internal.
