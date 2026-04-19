"use client";

import React from "react";
import { Activity } from "lucide-react";

export default function TrackJobButton({ jobId, status }: { jobId: string; status: string }) {
  const handleTrack = () => {
    window.dispatchEvent(
      new CustomEvent("track-job", {
        detail: { jobId },
      })
    );
  };

  if (status === "processing") {
    return (
      <button
        onClick={handleTrack}
        className="badge badge-warning flex items-center gap-1 hover:brightness-110 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)] transition-all"
        title="Nhấn để theo dõi tiến độ"
      >
        <Activity className="w-3 h-3 animate-pulse" />
        Đang xử lý
      </button>
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
