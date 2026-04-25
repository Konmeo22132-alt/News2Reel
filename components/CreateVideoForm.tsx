"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Loader2, CheckCircle, XCircle, Link, ExternalLink, Activity } from "lucide-react";

type JobData = {
  id: string;
  sourceUrl: string;
  status: string;
  resultUrl: string | null;
  logs: string[];
  currentStep: string;
  progress: number;
  errorDetails: string | null;
};

type SystemStats = { ramPercent: number; cpuLoad: number; etaSeconds: number; vCpus: number };

type JobState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "polling"; jobId: string; jobData?: JobData; systemStats?: SystemStats }
  | { phase: "done"; resultUrl: string }
  | { phase: "error"; message: string };

interface CreateVideoFormProps {
  defaultSources?: string[]; // From config.newsSources
}

export default function CreateVideoForm({ defaultSources = [] }: CreateVideoFormProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [engine, setEngine] = useState<"ffmpeg" | "remotion" | "hyperframes">("ffmpeg");
  const [state, setState] = useState<JobState>({ phase: "idle" });
  const [statusText, setStatusText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll job status
  useEffect(() => {
    if (state.phase !== "polling") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const jobId = state.jobId;
    let attempts = 0; // tracked only for logging, no hard limit
    const _ = attempts; // suppress unused warning

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        const job = data.job as JobData;

        // Update working state with incoming logs and stats
        setState((prev) => (prev.phase === "polling" ? { ...prev, jobData: job, systemStats: data.systemStats } : prev));
        
        if (job.status === "completed") {
          clearInterval(pollRef.current!);
          setState({ phase: "done", resultUrl: job.resultUrl ?? "" });
          setStatusText("Video đã sẵn sàng!");
        } else if (job.status === "failed") {
          clearInterval(pollRef.current!);
          setState({ phase: "error", message: job.errorDetails || "Pipeline thất bại." });
        } else if (job.status === "processing") {
          setStatusText(`${job.currentStep ?? "Đang xử lý..."} — ${job.progress ?? 0}%`);
        } else {
          setStatusText("Đang chờ xử lý...");
        }

        // No timeout — wait for server to mark job as 'failed' if something goes wrong
      } catch {
        // Network error — keep polling
      }
    };

    poll(); // run immediately
    pollRef.current = setInterval(poll, 4000); // 4s polling — generous for complex scenes

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.phase, state.phase === "polling" ? state.jobId : null]); // depend strictly on phase/id to not reset interval

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state]);

  // Listen to global track-job events
  useEffect(() => {
    const handleTrackJob = (event: Event) => {
      const customEvent = event as CustomEvent<{ jobId: string }>;
      const { jobId } = customEvent.detail;
      setOpen(true);
      setState({ phase: "polling", jobId });
      setStatusText("Đang kết nối lại luồng theo dõi...");
    };

    window.addEventListener("track-job", handleTrackJob);
    return () => window.removeEventListener("track-job", handleTrackJob);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState({ phase: "creating" });
    setStatusText("Đang tạo job...");

    try {
      const res = await fetch("/api/jobs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url.trim(), engine }),
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
            <div className="mb-4 space-y-3">
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-400">✅ Video hoàn thành!</p>
                  {state.resultUrl && (
                    <a
                      href={state.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-1"
                      style={{ color: "#818cf8" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Tải xuống / Mở mới
                    </a>
                  )}
                </div>
                <button onClick={reset} className="btn btn-ghost text-xs py-1 px-3">Tạo tiếp</button>
              </div>
              {/* Inline video preview */}
              {state.resultUrl && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <video
                    src={state.resultUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      width: "100%",
                      maxHeight: "420px",
                      background: "#000",
                      display: "block",
                    }}
                  />
                  <div
                    className="flex items-center justify-between px-3 py-2 text-xs"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                  >
                    <span>Preview inline · {engine.toUpperCase()} engine</span>
                    <a
                      href={state.resultUrl}
                      download
                      className="inline-flex items-center gap-1"
                      style={{ color: "#818cf8" }}
                    >
                      <ExternalLink className="w-3 h-3" /> Tải xuống
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {state.phase === "error" && (
            <div
              className="flex flex-col gap-3 p-3 rounded-lg mb-4"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
                    Pipeline thất bại
                  </p>
                  <p className="text-xs mt-1 bg-red-950/30 p-2 rounded border border-red-500/20 font-mono break-all" style={{ color: "#fca5a5" }}>
                    {state.message}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={reset} className="btn btn-ghost text-xs py-1 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-300">
                  Đóng & Thử lại
                </button>
              </div>
            </div>
          )}

          {isPending && (
            <div
              className="flex flex-col gap-3 p-4 rounded-lg mb-4"
              style={{
                background: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <div className="flex items-center gap-3 border-b border-indigo-500/10 pb-3">
                <Loader2 className="w-5 h-5 flex-shrink-0 spin" style={{ color: "#818cf8" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-2" style={{ color: "#a5b4fc" }}>
                    {state.phase === "polling" && state.jobData ? state.jobData.currentStep : statusText}
                    {state.phase === "polling" && state.jobData && (
                      <span className="text-xs font-bold" style={{ color: "#818cf8" }}>{state.jobData.progress ?? 0}%</span>
                    )}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full mt-3" style={{ background: "rgba(99,102,241,0.15)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${state.phase === "polling" && state.jobData ? state.jobData.progress ?? 0 : 0}%`,
                        background: "linear-gradient(90deg, #6366f1, #818cf8)",
                      }}
                    />
                  </div>
                  
                  {/* System Stats HUD */}
                  {state.phase === "polling" && state.systemStats && state.jobData?.status === "processing" && (
                     <div className="flex items-center gap-4 mt-3 text-[11px] font-medium opacity-80" style={{ color: "#a5b4fc" }}>
                        <span className="flex items-center gap-1.5" title="CPU Load">
                           <Activity className="w-3 h-3" />
                           {state.systemStats.cpuLoad}% vCPU
                        </span>
                        <span className="flex items-center gap-1.5" title="RAM Usage">
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                           {state.systemStats.ramPercent}% RAM
                        </span>
                        {state.systemStats.etaSeconds > 0 && (
                           <span className="flex items-center gap-1.5 ml-auto" title="Estimated Time">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ETA: {Math.floor(state.systemStats.etaSeconds / 60)}m {state.systemStats.etaSeconds % 60}s
                           </span>
                        )}
                     </div>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {["Scrape bài viết", "AI viết kịch bản", "Render Video", "Đăng TikTok"].map((step, idx, arr) => {
                      const isActive = state.phase === "polling" && state.jobData?.currentStep === step;
                      return (
                        <span key={step} className="flex items-center gap-1">
                          <span className={`${isActive ? "text-indigo-400" : ""}`}>{step}</span>
                          {idx < arr.length - 1 && <span className="text-gray-700 mx-1">/</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Real-time Logs Console */}
              {state.phase === "polling" && state.jobData && (
                <div 
                  ref={scrollRef}
                  className="bg-[#09090b] rounded-md p-3 text-[11px] font-mono leading-relaxed h-[180px] overflow-y-auto"
                  style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5 opacity-50">
                    <Activity className="w-3 h-3" />
                    <span>Real-time Pipeline Logs</span>
                  </div>
                  {state.jobData.logs?.map((log, i) => (
                    <div key={i} className="mb-1 opacity-80" style={{ color: log.includes("❌") ? "#ef4444" : "#a5b4fc" }}>
                      <span className="opacity-50 mr-2">{">"}</span>{log}
                    </div>
                  ))}
                  {state.jobData.logs?.length === 0 && (
                    <div className="opacity-30 italic">Đang chờ khởi tạo container...</div>
                  )}
                  <div className="flex items-center gap-2 mt-2 opacity-30">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                    Đang theo dõi...
                  </div>
                </div>
              )}
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

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Rendering Engine
                </label>
                <div className="flex flex-col gap-1.5">
                  {([
                    { value: "ffmpeg",       label: "FFmpeg",       badge: "Nhanh",     desc: "Server-side, không cần Chrome",        badgeColor: "#10b981" },
                    { value: "remotion",     label: "Remotion",     badge: "HQ Viral",  desc: "React component, Ken Burns + karaoke", badgeColor: "#818cf8" },
                    { value: "hyperframes",  label: "HyperFrames",  badge: "Cinematic", desc: "HTML/GSAP, animation đẹp nhất",         badgeColor: "#f59e0b" },
                  ] as const).map(({ value, label, badge, desc, badgeColor }) => (
                    <label
                      key={value}
                      className="flex items-center gap-3 p-2.5 rounded cursor-pointer border transition-colors hover:bg-gray-800/20"
                      style={{
                        borderColor: engine === value ? badgeColor + "66" : "var(--border)",
                        background: engine === value ? badgeColor + "0d" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="engine"
                        value={value}
                        checked={engine === value}
                        onChange={() => setEngine(value)}
                        className="accent-indigo-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: badgeColor + "22", color: badgeColor }}
                          >{badge}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
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
                Pipeline: Scrape bài → AI kịch bản → {engine === "hyperframes" ? "HyperFrames HTML/GSAP" : engine === "remotion" ? "Remotion React" : "FFmpeg"} render → Đăng TikTok
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
