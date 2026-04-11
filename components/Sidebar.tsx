"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  Settings,
  LogOut,
  Menu,
  X,
  Video,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "Lịch sử Video", icon: Film },
  { href: "/settings", label: "Cấu hình", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-2 space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              background: active ? "rgba(99,102,241,0.15)" : "transparent",
              color: active ? "#a5b4fc" : "var(--text-secondary)",
              border: active ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-4 h-14 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          <Video className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm gradient-text">AutoVideo CMS</span>
      </div>

      <NavLinks />

      {/* Bottom */}
      <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-danger w-full justify-start text-sm"
        >
          {loggingOut ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-3 left-3 z-50 lg:hidden w-9 h-9 flex items-center justify-center rounded-lg"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 lg:hidden transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <SidebarInner />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <SidebarInner />
      </aside>
    </>
  );
}
