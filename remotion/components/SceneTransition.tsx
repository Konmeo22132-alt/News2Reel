import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * SceneTransition v2 — VPS-safe transitions.
 *
 * REMOVED all CSS filter: blur() — causes hangs on headless Chromium.
 * All transitions now use only: opacity, transform, background gradients.
 */

const TRANSITION_FRAMES = 10;

export type TransitionType = "zoom" | "glitch" | "whip" | "fade";

// ── Zoom Through (no blur) ──────────────────────────────────────────────────

const ZoomTransition: React.FC<{ progress: number }> = ({ progress }) => {
  const scale = interpolate(progress, [0, 1], [1, 2.0]);
  const opacity = interpolate(progress, [0, 0.5, 1], [0, 0.4, 1]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,${opacity}) 70%)`,
          transform: `scale(${scale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: interpolate(progress, [0.7, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      />
    </div>
  );
};

// ── Glitch Cut ──────────────────────────────────────────────────────────────

const GlitchTransition: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const splitX = interpolate(progress, [0, 0.3, 0.6, 1], [0, 12, -8, 0]);
  const isFlashFrame = frame % 3 === 0 && progress > 0.2 && progress < 0.8;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,0,0,0.12)",
          transform: `translateX(${splitX}px)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,255,255,0.1)",
          transform: `translateX(${-splitX}px)`,
          mixBlendMode: "screen",
        }}
      />
      {isFlashFrame && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.25)" }} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: interpolate(progress, [0.8, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      />
    </div>
  );
};

// ── Whip Pan (no blur) ──────────────────────────────────────────────────────

const WhipTransition: React.FC<{ progress: number }> = ({ progress }) => {
  const barX = interpolate(progress, [0, 1], [100, -100]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.95) 60%, transparent 100%)",
          transform: `translateX(${barX}%)`,
        }}
      />
    </div>
  );
};

// ── Fade ─────────────────────────────────────────────────────────────────────

const FadeTransition: React.FC<{ progress: number }> = ({ progress }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "#050510",
      opacity: interpolate(progress, [0, 1], [0, 1]),
      zIndex: 150,
      pointerEvents: "none",
    }}
  />
);

// ── Scene Entrance ──────────────────────────────────────────────────────────

export const SceneEntrance: React.FC<{ type?: TransitionType }> = () => {
  const frame = useCurrentFrame();
  const entranceFrames = 8;
  if (frame >= entranceFrames) return null;

  const progress = interpolate(frame, [0, entranceFrames], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#050510",
        opacity: progress,
        zIndex: 150,
        pointerEvents: "none",
      }}
    />
  );
};

// ── Scene Exit ──────────────────────────────────────────────────────────────

export const SceneExit: React.FC<{
  type?: TransitionType;
  durationFrames?: number;
}> = ({ type = "fade", durationFrames = TRANSITION_FRAMES }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const exitStart = durationInFrames - durationFrames;
  if (frame < exitStart) return null;

  const progress = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  switch (type) {
    case "zoom":
      return <ZoomTransition progress={progress} />;
    case "glitch":
      return <GlitchTransition progress={progress} frame={frame} />;
    case "whip":
      return <WhipTransition progress={progress} />;
    case "fade":
    default:
      return <FadeTransition progress={progress} />;
  }
};

const TRANSITION_CYCLE: TransitionType[] = ["zoom", "glitch", "whip", "zoom", "fade"];

export function getTransitionType(sceneIndex: number): TransitionType {
  return TRANSITION_CYCLE[sceneIndex % TRANSITION_CYCLE.length];
}
