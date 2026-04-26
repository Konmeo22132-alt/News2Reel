# 🎬 News2Reel

**News2Reel** là một pipeline tự động hóa hoàn toàn việc biến một bài báo (URL) thành một video ngắn (Shorts/TikTok/Reels) chất lượng cao mang phong cách cinematic, có khả năng giữ chân người xem cao nhờ nhịp điệu nhanh và thiết kế hấp dẫn.

## ✨ Tính năng nổi bật

- **100% Tự động:** Chỉ cần nhập URL bài báo, hệ thống sẽ lo toàn bộ từ scraping, viết kịch bản, lồng tiếng đến render hình ảnh.
- **AI Đa Tác Tử (Multi-Agent):**
  - **Script Agent:** Tạo kịch bản giật gân, phân chia cảnh và chèn hiệu ứng tự động (hỗ trợ Groq, OpenAI tương thích).
  - **Vision Agent (Optional):** Phân tích hình ảnh thực tế từ bài báo để giúp kịch bản khớp với hình ảnh hơn.
- **Render Engine Hiện Đại (Remotion):** Tạo video bằng React/Web technologies, cho phép các hiệu ứng phức tạp:
  - **Cinematic Hook:** 3 giây đầu với flash, camera shake, zoom burst, title slam để "stop the scroll".
  - **Dynamic Subtitles:** Phụ đề kiểu karaoke từng từ, phóng to và phát sáng (glow) các từ khóa quan trọng.
  - **Scene Transitions:** Các hiệu ứng chuyển cảnh điện ảnh (Zoom through, Glitch cut, Whip pan, Fade).
  - **Post-processing:** Tích hợp bộ lọc màu (color grade) và hiệu ứng vignette.
- **Tối Ưu Cho VPS Headless:** Render engine được tinh chỉnh đặc biệt để chạy mượt mà trên môi trường VPS cấu hình thấp (từ 2GB - 4GB RAM) không có GPU thực. Chống treo (hang) và chống OOM (Out Of Memory) killer hiệu quả.
- **Microsoft Edge TTS:** Lồng tiếng tự động sử dụng giọng đọc AI tự nhiên chất lượng cao.

## 🚀 Cài đặt & Khởi chạy

### Yêu cầu hệ thống
- Node.js >= 18
- PM2 (để chạy production)
- FFmpeg (cần thiết cho post-processing và âm thanh)
- VPS khuyến nghị: Ubuntu, >= 4GB RAM (hoặc 2GB RAM + Swap).

### Setup

1. **Clone repository và cài đặt thư viện:**
   ```bash
   git clone <repo-url>
   cd autovideo-admin
   npm install
   ```

2. **Cấu hình môi trường:**
   Tạo file `.env` dựa trên `.env.example` và điền các API keys cần thiết (MongoDB, AI Provider, etc.).

3. **Thiết lập Swap (Cực kỳ quan trọng cho VPS):**
   Nếu bạn chạy trên VPS ít RAM, hãy chạy script để tạo swap space nhằm tránh OOM khi render video.
   ```bash
   chmod +x scripts/setup-swap.sh
   sudo ./scripts/setup-swap.sh
   ```

### Chạy ở môi trường Development
```bash
npm run dev
```

### Chạy ở môi trường Production
Nên sử dụng PM2 để quản lý process và đảm bảo hệ thống không bị sập khi render nặng.
```bash
npm run build
pm2 startOrRestart ecosystem.config.js
pm2 save
```

## 🏗 Cấu trúc dự án

- `/app`: Chứa Next.js App Router (Giao diện Admin Dashboard, API endpoints).
- `/lib`: Chứa logic lõi (Scraper, AI Agents, Job Processor, DB Models).
- `/remotion`: Chứa source code React tạo hình cho Video (Compositions, Components, Layout constants).
- `/public`: Nơi lưu trữ tài nguyên tĩnh và các video sau khi render thành công.
- `/scripts`: Các tiện ích cài đặt và bảo trì hệ thống.

## 🤖 Xem thêm

- [AI Agents Architecture (AGENTS.md)](./AGENTS.md): Tìm hiểu cách các LLM tác hợp với nhau.
- [TODO.md](./TODO.md): Lộ trình và các tính năng sắp ra mắt.

## 📝 License
Proprietary / Internal.
