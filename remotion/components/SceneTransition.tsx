import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { FRAME_WIDTH, FRAME_HEIGHT } from "../constants/layout";

/**
 * SceneTransition — Cinematic transition overlays between scenes.
 *
 * Place this component at the END of each Sequence (last N frames).
 * It renders over the current scene content to create exit animations.
 *
 * Types:
 *   "zoom"   — Zoom in + radial blur (zoom-through effect)
 *   "glitch" — RGB split + horizontal distortion (2-3 frames)
 *   "whip"   — Horizontal whip pan with motion blur
 *   "fade"   — Simple cross-fade to black
 */

const TRANSITION_FRAMES = 10; // ~0.33s at 30fps

export type TransitionType = "zoom" | "glitch" | "whip" | "fade";

// ── Zoom Through ─────────────────────────────────────────────────────────────

const ZoomTransition: React.FC<{ progress: number }> = ({ progress }) => {
  const scale = interpolate(progress, [0, 1], [1, 2.5], {
    easing: Easing.in(Easing.cubic),
  });
  const opacity = interpolate(progress, [0, 0.6, 1], [0, 0.3, 1]);
  const blur = interpolate(progress, [0, 1], [0, 12]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 150,
        pointerEvents: "none",
      }}
    >
      {/* Radial blur effect (dark overlay that zooms) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, transparent 0%, rgba(0,0,0,${opacity}) 70%)`,
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
        }}
      />
      {/* Final blackout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: interpolate(progress, [0.7, 1], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />
    </div>
  );
};

// ── Glitch Cut ───────────────────────────────────────────────────────────────

const GlitchTransition: React.FC<{ progress: number; frame: number }> = ({
  progress,
  frame,
}) => {
  // RGB split offset
  const splitX = interpolate(progress, [0, 0.3, 0.6, 1], [0, 15, -10, 0]);
  const splitY = interpolate(progress, [0, 0.4, 0.7, 1], [0, -8, 5, 0]);

  // Horizontal scan line distortion
  const scanOffset = Math.sin(frame * 3.7) * 30 * progress;

  // Flash on specific frames for "glitch" feel
  const isFlashFrame = frame % 3 === 0 && progress > 0.2 && progress < 0.8;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 150,
        pointerEvents: "none",
      }}
    >
      {/* Red channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,0,0,0.15)",
          transform: `translate(${splitX}px, ${splitY}px)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Cyan channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,255,255,0.12)",
          transform: `translate(${-splitX}px, ${-splitY}px)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Horizontal scan distortion */}
      <div
        style={{
          position: "absolute",
          top: `${40 + scanOffset}%`,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.4)",
          transform: `translateX(${scanOffset}px)`,
        }}
      />
      {/* Flash */}
      {isFlashFrame && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.3)",
          }}
        />
      )}
      {/* Exit blackout */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: interpolate(progress, [0.8, 1], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      />
    </div>
  );
};

// ── Whip Pan ─────────────────────────────────────────────────────────────────

const WhipTransition: React.FC<{ progress: number }> = ({ progress }) => {
  // Dark bar sweeps from right to left
  const barX = interpolate(progress, [0, 1], [FRAME_WIDTH, -FRAME_WIDTH], {
    easing: Easing.inOut(Easing.cubic),
  });
  const blurAmount = interpolate(progress, [0, 0.5, 1], [0, 20, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 150,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Motion blur overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: `blur(${blurAmount}px)`,
          background: `linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.95) 60%, transparent 100%)`,
          transform: `translateX(${barX}px)`,
          width: FRAME_WIDTH * 2,
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

// ── Scene Entrance (placed at START of scene) ────────────────────────────────

export const SceneEntrance: React.FC<{ type?: TransitionType }> = ({
  type = "fade",
}) => {
  const frame = useCurrentFrame();

  // Entrance: first 8 frames, progress goes 1→0 (revealing content)
  const entranceFrames = 8;
  if (frame >= entranceFrames) return null;

  const progress = interpolate(frame, [0, entranceFrames], [1, 0], {
    extrapolateRight: "clamp",
  });

  // For entrance, we just do a fade-from-black (clean, works with any exit)
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

// ── Scene Exit (placed at END of scene) ──────────────────────────────────────

export const SceneExit: React.FC<{
  type?: TransitionType;
  durationFrames?: number;
}> = ({ type = "zoom", durationFrames = TRANSITION_FRAMES }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Only render during the last N frames of the scene
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

// Transition type cycling for variety between scenes
const TRANSITION_CYCLE: TransitionType[] = ["zoom", "glitch", "whip", "zoom", "fade"];

export function getTransitionType(sceneIndex: number): TransitionType {
  return TRANSITION_CYCLE[sceneIndex % TRANSITION_CYCLE.length];
}
