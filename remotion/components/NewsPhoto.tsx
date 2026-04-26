import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, staticFile, Easing } from "remotion";
import { CONTENT_MAX_BOTTOM, FRAME_WIDTH } from "../constants/layout";

interface Props {
  imageUrl?: string;
}

/**
 * NewsPhoto v2 — Cinematic image with Ken Burns + zoom entrance.
 *
 * Improvements:
 *   ✨ Zoom-in entrance (1.15→1.0) for drama on scene start
 *   ✨ Stronger Ken Burns (1.0→1.12 + larger pan range)
 *   ✨ Parallax-feel with separate background/foreground motion
 *   ✨ Color grade overlay (teal shadows, warm highlights)
 *   ✨ Stronger vignette
 *
 * Layout rules:
 *   - Image is CLIPPED at CONTENT_MAX_BOTTOM (1440px) — never enters SubtitleZone
 *   - Blurred background fill to eliminate black bars for non-9:16 images
 */
export const NewsPhoto: React.FC<Props> = ({ imageUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Zoom-in entrance: 1.15 → 1.0 in first 15 frames
  const entranceZoom = interpolate(frame, [0, 15], [1.15, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Ken Burns: slow zoom 1.0→1.12 over full duration
  const kenBurnsZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.12], {
    extrapolateRight: "clamp",
  });

  // Combined zoom: entrance * ken burns
  const totalZoom = entranceZoom * kenBurnsZoom;

  // Horizontal drift (parallax feel)
  const translateX = interpolate(frame, [0, durationInFrames], [-20, 20], {
    extrapolateRight: "clamp",
  });

  // Vertical drift (subtle)
  const translateY = interpolate(frame, [0, durationInFrames], [5, -5], {
    extrapolateRight: "clamp",
  });

  // Background layer moves slower (parallax)
  const bgTranslateX = translateX * 0.3;
  const bgTranslateY = translateY * 0.3;

  const contentHeight = CONTENT_MAX_BOTTOM; // 1440

  // CRITICAL: Only use local static files — never external URLs.
  const isLocalPath = imageUrl && !imageUrl.startsWith("http");
  const imgSrc = isLocalPath ? staticFile(imageUrl!) : null;

  if (!imgSrc) {
    // No image or external URL — render animated gradient placeholder
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: FRAME_WIDTH,
          height: contentHeight,
          background: `linear-gradient(160deg, #0a0f18 0%, #020408 100%)`,
          overflow: "hidden",
        }}
      >
        {/* Animated grid */}
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: 0.08,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            transform: `translateY(${frame * 0.5}px)`,
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
        background: "#000",
      }}
    >
      {/* Background blur fill — eliminates black bars (parallax slower) */}
      <Img
        src={imgSrc}
        style={{
          position: "absolute",
          width: "120%",
          height: "120%",
          top: "-10%",
          left: "-10%",
          objectFit: "cover",
          filter: "blur(40px) brightness(30%) saturate(1.3)",
          transform: `translate(${bgTranslateX}px, ${bgTranslateY}px) scale(1.15)`,
        }}
      />

      {/* Foreground image with Ken Burns + entrance zoom */}
      <Img
        src={imgSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${totalZoom}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: "center center",
        }}
      />

      {/* Color grade overlay — teal shadows, warm highlights */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,50,80,0.12) 0%, rgba(30,10,0,0.08) 100%)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Vignette overlay — stronger than v1 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 220px rgba(0,0,0,0.8)",
        }}
      />

      {/* Top darkening gradient — ensures banner text readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "25%",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
        }}
      />

      {/* Bottom gradient mask — blends into subtitle zone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "40%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(5,5,16,0.6) 50%, rgba(5,5,16,0.95) 100%)",
        }}
      />
    </div>
  );
};
