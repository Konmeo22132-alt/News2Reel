"use client";

import { useState, useEffect } from "react";

interface ClientDateProps {
  date: Date | string | null;
  fallback?: string;
}

/**
 * Renders a date only on the client side to avoid SSR/hydration mismatch
 * caused by locale-based Intl.DateTimeFormat differences between server and client.
 */
export default function ClientDate({ date, fallback = "—" }: ClientDateProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setFormatted(fallback);
      return;
    }
    try {
      setFormatted(
        new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(date))
      );
    } catch {
      setFormatted(fallback);
    }
  }, [date, fallback]);

  // Render a consistent placeholder server-side to avoid mismatch
  if (formatted === null) {
    return (
      <span style={{ color: "var(--text-muted)" }}>
        {date ? "..." : fallback}
      </span>
    );
  }

  return <span>{formatted}</span>;
}
