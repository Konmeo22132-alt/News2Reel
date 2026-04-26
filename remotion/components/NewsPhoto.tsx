import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { CONTENT_MAX_BOTTOM, FRAME_WIDTH } from "../constants/layout";

interface Props {
  imageUrl?: string;
}

/**
 * NewsPhoto v3 — VPS-safe cinematic image.
 *
 * LESSONS LEARNED (from crashes):
 *   ❌ blur(40px) CSS filter → hangs headless Chromium on VPS
 *   ❌ Two <Img> tags → double delayRender, double memory
 *   ❌ Easing import → can crash if version mismatch
 *
 * v3 keeps visual quality but removes ALL CSS filters:
 *   ✅ Single <Img> with Ken Burns (zoom + drift)
 *   ✅ Dark gradient background instead of blurred image
 *   ✅ Color grade via gradient overlay (no filter)
 *   ✅ Strong vignette via box-shadow (no filter)
 */
export const NewsPhoto: React.FC<Props> = ({ imageUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns: slow zoom over full duration
  const kenBurnsZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  // Horizontal drift
  const translateX = interpolate(frame, [0, durationInFrames], [-10, 10], {
    extrapolateRight: "clamp",
  });

  const contentHeight = CONTENT_MAX_BOTTOM;

  // Only local static files — never external URLs
  const isLocalPath = imageUrl && !imageUrl.startsWith("http");
  const imgSrc = isLocalPath ? staticFile(imageUrl!) : null;

  if (!imgSrc) {
    // No image — render dark gradient placeholder
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: FRAME_WIDTH,
          height: contentHeight,
          background: "linear-gradient(160deg, #0a0f18 0%, #020408 100%)",
          overflow: "hidden",
        }}
      >
        {/* Animated grid */}
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: 0.06,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            transform: `translateY(${frame * 0.3}px)`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: FRAME_WIDTH,
        height: contentHeight,
        overflow: "hidden",
        background: "#030308",
      }}
    >
      {/* SINGLE image — Ken Burns zoom + drift. NO blur, NO double Img. */}
      <Img
        src={imgSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${kenBurnsZoom}) translateX(${translateX}px)`,
          transformOrigin: "center center",
        }}
      />

      {/* Color grade overlay — teal/warm via gradient (NO CSS filter) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,40,60,0.1) 0%, rgba(20,8,0,0.06) 100%)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Vignette — box-shadow only (NO filter) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.7)",
        }}
      />

      {/* Top darkening gradient — text readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "25%",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
        }}
      />

      {/* Bottom gradient — blends into subtitle zone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(5,5,16,0.5) 50%, rgba(5,5,16,0.95) 100%)",
        }}
      />
    </div>
  );
};
