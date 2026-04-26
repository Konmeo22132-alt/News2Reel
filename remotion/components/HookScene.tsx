import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { ZONES, FRAME_WIDTH, FONT_SIZES } from "../constants/layout";

/**
 * HookScene v2 — VPS-safe cinematic hook.
 *
 * REMOVED: Easing import (can cause issues), complex CSS.
 * KEPT: flash, camera shake, title slam, accent wipe — all pure CSS transform/opacity.
 */

function cameraShake(frame: number): { x: number; y: number } {
  const seed = (n: number) => Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  const rand = (n: number) => seed(n) - Math.floor(seed(n));
  const intensity = interpolate(frame, [0, 5, 15], [10, 6, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  return {
    x: (rand(frame * 1.3) - 0.5) * 2 * intensity,
    y: (rand(frame * 2.7) - 0.5) * 2 * intensity,
  };
}

const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, 4], [0.9, 0.8, 0], {
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

const AccentWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [10, 18], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
        height: 5,
        borderRadius: 3,
        background: "linear-gradient(90deg, #E53935, #FF6F00)",
        opacity,
        zIndex: 55,
        boxShadow: "0 0 16px rgba(229,57,53,0.5)",
      }}
    />
  );
};

const HookTitle: React.FC<{ title: string; hook?: string }> = ({ title, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 12, mass: 1, stiffness: 180 },
  });

  const titleY = interpolate(titleSpring, [0, 1], [100, 0]);
  const titleScale = interpolate(titleSpring, [0, 0.5, 1], [0.7, 1.03, 1]);

  const hookOpacity = interpolate(frame, [20, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hookY = interpolate(frame, [20, 28], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      {/* BREAKING NEWS pill */}
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
          boxShadow: "0 6px 24px rgba(229,57,53,0.4)",
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 0 6px rgba(255,255,255,0.7)",
          }}
        />
        <span
          style={{
            fontWeight: 800,
            fontSize: 26,
            color: "#fff",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          BREAKING NEWS
        </span>
      </div>

      {/* Main Title */}
      <div
        style={{
          transform: `translateY(${titleY}px) scale(${titleScale})`,
          transformOrigin: "left center",
        }}
      >
        <h1
          style={{
            fontWeight: 900,
            fontSize: Math.min(FONT_SIZES.hook, 72),
            color: "#fff",
            lineHeight: 1.15,
            letterSpacing: -1,
            textShadow:
              "3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 6px 24px rgba(0,0,0,0.9)",
            maxWidth: FRAME_WIDTH - 80,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Hook subtitle */}
      {hook && (
        <p
          style={{
            fontWeight: 600,
            fontSize: 36,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.35,
            marginTop: 20,
            opacity: hookOpacity,
            transform: `translateY(${hookY}px)`,
            textShadow: "2px 2px 0 #000, 0 4px 16px rgba(0,0,0,0.8)",
            maxWidth: FRAME_WIDTH - 100,
          }}
        >
          {hook}
        </p>
      )}
    </div>
  );
};

export const HookScene: React.FC<{
  title: string;
  hook?: string;
}> = ({ title, hook }) => {
  const frame = useCurrentFrame();
  const shake = cameraShake(frame);

  const zoomBurst = interpolate(frame, [0, 15], [1.3, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${shake.x}px, ${shake.y}px) scale(${zoomBurst})`,
        transformOrigin: "center center",
        zIndex: 40,
      }}
    >
      <FlashOverlay />
      <AccentWipe />
      <HookTitle title={title} hook={hook} />
    </div>
  );
};
