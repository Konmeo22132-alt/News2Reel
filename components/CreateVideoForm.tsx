"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Loader2, CheckCircle, XCircle, Link, ExternalLink } from "lucide-react";

type JobState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "polling"; jobId: string }
  | { phase: "done"; resultUrl: string }
  | { phase: "error"; message: string };

interface CreateVideoFormProps {
  defaultSources?: string[]; // From config.newsSources
}

export default function CreateVideoForm({ defaultSources = [] }: CreateVideoFormProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<JobState>({ phase: "idle" });
  const [statusText, setStatusText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll job status
  useEffect(() => {
    if (state.phase !== "polling") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const jobId = state.jobId;
    let attempts = 0;
    const MAX_ATTEMPTS = 120; // 10 minutes at 5s intervals

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        const job = data.job;

        if (job.status === "completed") {
          clearInterval(pollRef.current!);
          setState({ phase: "done", resultUrl: job.resultUrl ?? "" });
          setStatusText("Video đã sẵn sàng!");
        } else if (job.status === "failed") {
          clearInterval(pollRef.current!);
          setState({ phase: "error", message: "Pipeline thất bại. Kiểm tra API key và nguồn URL." });
        } else if (job.status === "processing") {
          setStatusText("Pipeline đang chạy: Scrape → AI → Render...");
        } else {
          setStatusText("Đang chờ xử lý...");
        }

        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(pollRef.current!);
          setState({ phase: "error", message: "Timeout: Pipeline mất quá 10 phút" });
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState({ phase: "creating" });
    setStatusText("Đang tạo job...");

    try {
      const res = await fetch("/api/jobs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        setState({ phase: "error", message: data.error ?? "Lỗi không xác định" });
        return;
      }

      setState({ phase: "polling", jobId: data.jobId });
      setStatusText("Job đã được tạo, pipeline đang khởi động...");
    } catch {
      setState({ phase: "error", message: "Không thể kết nối server" });
    }
  };

  const reset = () => {
    setState({ phase: "idle" });
    setUrl("");
    setStatusText("");
  };

  const isPending = state.phase === "creating" || state.phase === "polling";

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Tạo video mới
        </button>
      ) : (
        <div
          className="card p-5 mb-6"
          style={{ border: "1px solid rgba(99,102,241,0.3)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              🎬 Tạo Video Tự Động
            </h3>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              ✕ Đóng
            </button>
          </div>

          {/* Status display */}
          {state.phase === "done" && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg mb-4"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-400">
                  ✅ Video hoàn thành!
                </p>
                {state.resultUrl && (
                  <a
                    href={state.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs mt-1"
                    style={{ color: "#818cf8" }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Xem video
                  </a>
                )}
              </div>
              <button onClick={reset} className="btn btn-ghost text-xs py-1 px-3">
                Tạo tiếp
              </button>
            </div>
          )}

          {state.phase === "error" && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg mb-4"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm" style={{ color: "#ef4444" }}>
                {state.message}
              </p>
              <button onClick={reset} className="btn btn-ghost text-xs py-1 px-3 ml-auto">
                Thử lại
              </button>
            </div>
          )}

          {isPending && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg mb-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <Loader2 className="w-5 h-5 flex-shrink-0 spin" style={{ color: "#818cf8" }} />
              <div>
                <p className="text-sm" style={{ color: "#a5b4fc" }}>
                  {statusText}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Scrape → Beeknoee AI → FFmpeg Render → TikTok (nếu bật)
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          {(state.phase === "idle" || state.phase === "creating") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  URL bài viết / trang nguồn tin
                </label>
                <div className="relative">
                  <Link
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://vnexpress.net/bai-viet-cu-the..."
                    className="input pl-10"
                    required
                    disabled={isPending}
                  />
                </div>

                {/* Quick pick from configured sources */}
                {defaultSources.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Nguồn đã cấu hình:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {defaultSources.slice(0, 6).map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setUrl(src)}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "var(--surface-3)",
                            border: "1px solid var(--border)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {new URL(src).hostname.replace("www.", "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || !url.trim()}
                  className="btn btn-primary flex-1"
                >
                  {state.phase === "creating" ? (
                    <Loader2 className="w-4 h-4 spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {state.phase === "creating" ? "Đang tạo..." : "Bắt đầu Pipeline"}
                </button>
              </div>

              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Pipeline: Thu thập bài → Beeknoee AI tạo kịch bản → FFmpeg render video → Đăng TikTok (nếu bật)
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
