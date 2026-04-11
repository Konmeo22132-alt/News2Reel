import type { Metadata } from "next";
import { getConfig } from "@/app/actions/config";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cấu hình",
};

export default async function SettingsPage() {
  const config = await getConfig();
  return (
    <div className="space-y-6 fade-up max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Cấu hình Hệ thống
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Quản lý AI, chất lượng kết xuất và chiến lược nội dung
        </p>
      </div>
      <SettingsForm config={config} />
    </div>
  );
}
