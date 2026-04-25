/**
 * Layout constants for Remotion 1080x1920 composition.
 *
 * Three non-overlapping vertical zones:
 *   TopZone     : 0    → 280px  — Breaking news banner, channel tag
 *   ContentZone : 280  → 1440px — Animation overlays, images, social cards
 *   SubtitleZone: 1440 → 1920px — Karaoke subtitle ONLY (nothing else enters here)
 *
 * Rule: Every component MUST respect its assigned zone.
 * SubtitleZone is SACRED — no other component may render here.
 */

export const FRAME_WIDTH  = 1080;
export const FRAME_HEIGHT = 1920;

export const ZONES = {
  top: { y: 0,    height: 280  },
  content: { y: 280,  height: 1160 }, // 280 → 1440
  subtitle: { y: 1440, height: 480  }, // 1440 → 1920 — SUBTITLE ONLY
} as const;

/** Maximum bottom edge that content (images, cards) can reach */
export const CONTENT_MAX_BOTTOM = ZONES.content.y + ZONES.content.height; // 1440px

/** Safe zones in % for CSS */
export const SUBTITLE_TOP_PCT = (ZONES.subtitle.y / FRAME_HEIGHT) * 100; // ≈ 75%

// ─── Typography Scale ─────────────────────────────────────────────────────────

export const FONT_SIZES = {
  hook:     80,   // Hook sentence — large, attention-grabbing
  title:    60,   // Scene/callout titles
  subtitle: 52,   // KaraokeSubtitle active word
  body:     42,   // Supporting text in animations
  label:    34,   // Small labels, metadata
  tag:      26,   // Channel name watermark, timestamps
} as const;

// ─── Animation Constants ──────────────────────────────────────────────────────

export const ANIM = {
  /** Slide-in from bottom: 0.4s */
  slideIn: { damping: 14, mass: 0.8, stiffness: 200 },
  /** Gentle settle: 0.6s */
  settle:  { damping: 18, mass: 1.0, stiffness: 160 },
  /** Snappy pop: 0.25s */
  pop:     { damping: 10, mass: 0.6, stiffness: 280 },
  /** Ease in-out cubic (for interpolate) */
  easing:  (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
} as const;
