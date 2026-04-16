import type { Metadata } from "next";
import { getDashboardStats } from "@/app/actions/config";
import type { VideoJob } from "@/lib/types";
import CreateVideoForm from "@/components/CreateVideoForm";
import ClientDate from "@/components/ClientDate";
import {
  VideoIcon,
  Zap,
  AlertTriangle,
  Activity,
  CheckCircle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Hoàn thành", cls: "badge-success" },
    processing: { label: "Đang xử lý", cls: "badge-warning" },
    failed: { label: "Thất bại", cls: "badge-danger" },
    pending: { label: "Chờ xử lý", cls: "badge-info" },
  };
  const cfg = map[status] ?? { label: status, cls: "badge-neutral" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

export default async function DashboardPage() {
  const { config, todayCompleted, recentJobs, dailyUsage } =
    await getDashboardStats();

  const apiOk = !!config.aiApiKey;
  const usagePct = Math.min(
    Math.round((dailyUsage / config.dailyVideoLimit) * 100),
    100
  );

  let newsSources: string[] = [];
  try {
    newsSources = JSON.parse(config.newsSources);
  } catch { /* empty */ }

  return (
    <div className="space-y-7 fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Tổng quan hệ thống tự động hóa video
          </p>
        </div>
        <CreateVideoForm defaultSources={newsSources} />
      </div>

      {/* API warning */}
      {!apiOk && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg"
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <strong className="text-red-400">Chưa cấu hình Beeknoee API Key.</strong>{" "}
            Pipeline sẽ thất bại khi tạo video.{" "}
            <a href="/settings" style={{ color: "#818cf8" }}>
              → Vào Settings
            </a>
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
              <VideoIcon className="w-4 h-4" style={{ color: "#818cf8" }} />
            </div>
            <span className="badge badge-neutral">
              <TrendingUp className="w-3 h-3" />
              Hôm nay
            </span>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{todayCompleted}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Video hoàn thành</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: apiOk ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
              {apiOk ? <Zap className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            </div>
            <span className={`badge ${apiOk ? "badge-success" : "badge-danger"}`}>{apiOk ? "Kết nối" : "Lỗi"}</span>
          </div>
          <p className={`text-2xl font-bold ${apiOk ? "text-emerald-400" : "text-red-400"}`}>
            {apiOk ? "Online" : "Offline"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Beeknoee AI API</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
              <Activity className="w-4 h-4" style={{ color: "#a78bfa" }} />
            </div>
            <span className="badge badge-warning">Giới hạn</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {dailyUsage}
            <span className="text-base font-normal ml-1" style={{ color: "var(--text-muted)" }}>/ {config.dailyVideoLimit}</span>
          </p>
          <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "var(--surface-3)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${usagePct}%`, background: usagePct > 80 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "#6366f1" }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{usagePct}% đã sử dụng</p>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Hoạt động gần đây</h2>
          <a href="/history" className="btn btn-ghost text-xs py-1.5 px-3">
            Xem tất cả <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="card overflow-hidden">
          {recentJobs.length === 0 ? (
            <div className="py-14 text-center" style={{ color: "var(--text-muted)" }}>
              <VideoIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có video nào được tạo</p>
              <p className="text-xs mt-1">Nhấn &ldquo;Tạo video mới&rdquo; để bắt đầu pipeline</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    {["ID", "Nguồn URL", "Trạng thái", "Kết quả", "Thời gian"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(recentJobs as VideoJob[]).map((job, idx) => (
                    <tr
                      key={job.id}
                      style={{ borderBottom: idx < recentJobs.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <td className="px-4 py-3">
                        <code className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                          {job.id.slice(0, 8)}
                        </code>
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate" style={{ color: "var(--text-secondary)" }} title={job.sourceUrl}>
                        {job.sourceUrl}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3">
                        {job.resultUrl ? (
                          <a href={job.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: "#818cf8" }}>
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Xem video
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                        <ClientDate date={job.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
