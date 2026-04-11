import type { Metadata } from "next";
import { getVideoHistory } from "@/app/actions/config";
import type { VideoJob } from "@/lib/types";
import ClientDate from "@/components/ClientDate";
import { Film, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lịch sử Video",
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

export default async function HistoryPage() {
  const { jobs, total } = await getVideoHistory(1, 100);

  const counts = {
    completed: (jobs as VideoJob[]).filter((j) => j.status === "completed").length,
    processing: (jobs as VideoJob[]).filter((j) => j.status === "processing").length,
    failed: (jobs as VideoJob[]).filter((j) => j.status === "failed").length,
    pending: (jobs as VideoJob[]).filter((j) => j.status === "pending").length,
  };

  return (
    <div className="space-y-7 fade-up">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Lịch sử Video
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          {total} bản ghi trong MongoDB
        </p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "completed", label: "Hoàn thành", color: "text-emerald-400" },
          { key: "processing", label: "Đang xử lý", color: "text-yellow-400" },
          { key: "failed", label: "Thất bại", color: "text-red-400" },
          { key: "pending", label: "Chờ xử lý", color: "text-cyan-400" },
        ].map(({ key, label, color }) => (
          <div key={key} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>
              {counts[key as keyof typeof counts]}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--text-muted)" }}>
            <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Chưa có video nào được tạo</p>
            <p className="text-xs mt-1">Dùng nút "Tạo video mới" trên Dashboard để bắt đầu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", background: "rgba(99,102,241,0.03)" }}>
                  {["ID", "URL Nguồn", "Trạng thái", "Kết quả", "Tạo lúc", "Hoàn thành"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(jobs as VideoJob[]).map((job, idx) => (
                  <tr
                    key={job.id}
                    style={{ borderBottom: idx < jobs.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                        {job.id.slice(0, 8)}
                      </code>
                    </td>
                    <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: "var(--text-secondary)" }} title={job.sourceUrl}>
                      {job.sourceUrl}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {job.resultUrl ? (
                        <a href={job.resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: "#818cf8" }}>
                          <ExternalLink className="w-3 h-3" />
                          Xem video
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <ClientDate date={job.createdAt} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <ClientDate date={job.completedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
