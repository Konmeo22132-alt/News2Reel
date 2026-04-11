import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AutoVideo Admin",
    template: "%s — AutoVideo Admin",
  },
  description: "Bảng điều khiển quản lý hệ thống tạo video tự động",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
