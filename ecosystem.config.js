/**
 * PM2 Ecosystem Config — News2Reel
 *
 * Key settings to survive long Remotion renders:
 *   - watch: false           → Remotion writes video files to public/ — must NOT trigger restart
 *   - treekill: false        → Do NOT kill child processes (Remotion/Chromium) on restart
 *   - max_memory_restart: 0  → Disable auto-restart on memory; Chromium is heavy during render
 *   - kill_timeout: 10000    → Give 10s for graceful shutdown before SIGKILL
 */
module.exports = {
  apps: [
    {
      name: "autovideo-3069",
      script: "node_modules/.bin/next",
      args: "start -p 3069",
      cwd: "/var/www/News2Reel",

      // ── Critical for Remotion renders ────────────────────────────────────
      watch: false,               // NEVER watch files (Remotion writes to public/)
      treekill: false,            // Don't kill Remotion child process on PM2 restart
      // max_memory_restart: "3G", // Keep disabled — Chromium needs room during render

      // ── Restart policy ────────────────────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",          // Must run >10s to count as a stable start
      restart_delay: 3000,        // 3s between restarts

      // ── Process management ────────────────────────────────────────────────
      kill_timeout: 10000,        // 10s graceful shutdown window

      // ── Logs ──────────────────────────────────────────────────────────────
      error_file: "/root/.pm2/logs/autovideo-3069-error.log",
      out_file:   "/root/.pm2/logs/autovideo-3069-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: "3069",
        // Give Node.js 3GB heap — plenty for Next.js + Remotion orchestration
        NODE_OPTIONS: "--max-old-space-size=3072",
      },
    },
  ],
};
