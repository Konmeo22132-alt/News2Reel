import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { ZONES, FRAME_WIDTH, FONT_SIZES } from "../constants/layout";

/**
 * HookScene — Cinematic 3-second hook that STOPS the scroll.
 *
 * Timeline (30fps):
 *   Frame 0-3:   White flash → dramatic reveal
 *   Frame 0-12:  Zoom burst 1.35→1.0 (image punches in)
 *   Frame 0-10:  Camera shake (random vibration, decays)
 *   Frame 8-22:  Title text SLAMS in from bottom with overshoot spring
 *   Frame 12-20: Red accent line WIPES across
 *   Frame 18-28: Subtitle hook fades in below title
 *   Frame 22+:   Gentle particle glow settles
 *
 * This replaces the old static TopBanner for hook scenes.
 */

// ── Camera Shake ─────────────────────────────────────────────────────────────

function cameraShake(frame: number): { x: number; y: number } {
  // Seeded pseudo-random using frame number for deterministic shake
  const seed = (n: number) => Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  const rand = (n: number) => seed(n) - Math.floor(seed(n));

  // Shake intensity decays exponentially: strong at frame 0, gone by frame 15
  const intensity = interpolate(frame, [0, 5, 15], [12, 8, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return {
    x: (rand(frame * 1.3) - 0.5) * 2 * intensity,
    y: (rand(frame * 2.7) - 0.5) * 2 * intensity,
  };
}

// ── Flash Overlay ─────────────────────────────────────────────────────────────

const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  // White flash: 100% opacity at frame 0, fade to 0 by frame 4
  const opacity = interpolate(frame, [0, 1, 4], [0.95, 0.85, 0], {
    extrapolateRight: "clamp",
  });

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#fff",
        opacity,
        zIndex: 200,
        pointerEvents: "none",
      }}
    />
  );
};

// ── Red Accent Wipe ───────────────────────────────────────────────────────────

const AccentWipe: React.FC = () => {
  const frame = useCurrentFrame();

  // Wipe from left to right, frame 12→20
  const progress = interpolate(frame, [10, 18], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out after wipe completes
  const opacity = interpolate(frame, [18, 24], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: ZONES.content.y + ZONES.content.height * 0.38,
        left: 40,
        width: `${progress}%`,
        maxWidth: FRAME_WIDTH - 80,
        height: 6,
        borderRadius: 3,
        background: "linear-gradient(90deg, #E53935, #FF6F00)",
        opacity,
        zIndex: 55,
        boxShadow: "0 0 20px rgba(229,57,53,0.6)",
      }}
    />
  );
};

// ── Main Hook Title (SLAM entrance) ──────────────────────────────────────────

const HookTitle: React.FC<{ title: string; hook?: string }> = ({ title, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title SLAMS in from below with overshoot spring
  const titleSpring = spring({
    frame: frame - 6, // Delay 6 frames
    fps,
    config: { damping: 11, mass: 1.2, stiffness: 200 }, // Overshoot bounce
  });

  const titleY = interpolate(titleSpring, [0, 1], [120, 0]);
  const titleScale = interpolate(titleSpring, [0, 0.5, 1], [0.7, 1.05, 1]);

  // Hook subtitle fades in after title
  const hookOpacity = interpolate(frame, [20, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hookY = interpolate(frame, [20, 28], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        top: ZONES.content.y + ZONES.content.height * 0.25,
        left: 40,
        right: 40,
        zIndex: 60,
      }}
    >
      {/* BREAKING NEWS pill — small, punchy */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: "#E53935",
          borderRadius: 8,
          padding: "10px 20px",
          marginBottom: 20,
          transform: `translateY(${titleY}px) scale(${titleScale})`,
          boxShadow: "0 8px 32px rgba(229,57,53,0.5)",
        }}
      >
        {/* Pulsing dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 0 8px rgba(255,255,255,0.8)",
          }}
        />
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: "#fff",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          BREAKING NEWS
        </span>
      </div>

      {/* Main Title — SLAM */}
      <div
        style={{
          transform: `translateY(${titleY}px) scale(${titleScale})`,
          transformOrigin: "left center",
        }}
      >
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 900,
            fontSize: Math.min(FONT_SIZES.hook, 76),
            color: "#fff",
            lineHeight: 1.15,
            letterSpacing: -2,
            textShadow:
              "4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 8px 30px rgba(0,0,0,0.9)",
            maxWidth: FRAME_WIDTH - 80,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Hook line — fade in after slam */}
      {hook && (
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 600,
            fontSize: 38,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.35,
            marginTop: 24,
            opacity: hookOpacity,
            transform: `translateY(${hookY}px)`,
            textShadow: "2px 2px 0 #000, 0 4px 20px rgba(0,0,0,0.8)",
            maxWidth: FRAME_WIDTH - 100,
          }}
        >
          {hook}
        </p>
      )}
    </div>
  );
};

// ── Vignette Pulse (subtle urgency) ──────────────────────────────────────────

const VignettePulse: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle pulsing vignette — creates visual urgency
  const pulseIntensity = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.6, 0.85]
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        boxShadow: `inset 0 0 200px rgba(0,0,0,${pulseIntensity})`,
        zIndex: 45,
        pointerEvents: "none",
      }}
    />
  );
};

// ── Export ────────────────────────────────────────────────────────────────────

export const HookScene: React.FC<{
  title: string;
  hook?: string;
}> = ({ title, hook }) => {
  const frame = useCurrentFrame();
  const shake = cameraShake(frame);

  // Zoom burst: starts zoomed in 1.35x, settles to 1.0 by frame 15
  const zoomBurst = interpolate(frame, [0, 15], [1.35, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // Camera shake + zoom burst applied to entire scene
        transform: `translate(${shake.x}px, ${shake.y}px) scale(${zoomBurst})`,
        transformOrigin: "center center",
        zIndex: 40,
      }}
    >
      <FlashOverlay />
      <VignettePulse />
      <AccentWipe />
      <HookTitle title={title} hook={hook} />
    </div>
  );
};
