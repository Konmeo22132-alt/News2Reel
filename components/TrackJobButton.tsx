"use client";

import React, { useState } from "react";
import { Activity, X, Loader2 } from "lucide-react";

export default function TrackJobButton({ jobId, status }: { jobId: string; status: string }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleTrack = () => {
    window.dispatchEvent(
      new CustomEvent("track-job", {
        detail: { jobId },
      })
    );
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger track
    if (!confirm("Xác nhận hủy job này?")) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCancelled(true);
      } else {
        alert(data.error || "Không thể hủy job");
      }
    } catch {
      alert("Lỗi kết nối server");
    } finally {
      setCancelling(false);
    }
  };

  if (cancelled) {
    return <span className="badge badge-danger">Đã hủy</span>;
  }

  if (status === "processing" || status === "pending") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleTrack}
          className="badge badge-warning flex items-center gap-1 hover:brightness-110 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all"
          title="Nhấn để theo dõi tiến độ"
        >
          <Activity className="w-3 h-3 animate-pulse" />
          Đang xử lý
        </button>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex items-center justify-center w-5 h-5 rounded-full transition-all hover:scale-110"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            cursor: cancelling ? "wait" : "pointer",
            opacity: cancelling ? 0.5 : 1,
          }}
          title="Hủy job này"
        >
          {cancelling ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </button>
      </div>
    );
  }

  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Hoàn thành", cls: "badge-success" },
    failed: { label: "Thất bại", cls: "badge-danger" },
    pending: { label: "Chờ xử lý", cls: "badge-info" },
  };
  const cfg = map[status] ?? { label: status, cls: "badge-neutral" };
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}
