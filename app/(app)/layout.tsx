import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar />
      <main className="lg:pl-56 min-h-screen">
        <div className="p-5 lg:p-7 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
