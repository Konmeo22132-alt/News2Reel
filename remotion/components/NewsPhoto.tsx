import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { CONTENT_MAX_BOTTOM, FRAME_WIDTH } from "../constants/layout";

interface Props {
  imageUrl?: string;
}

/**
 * NewsPhoto — Article image with Ken Burns effect.
 *
 * Layout rules:
 *   - Image is CLIPPED at CONTENT_MAX_BOTTOM (1440px) — never enters SubtitleZone
 *   - Ken Burns: slow zoom 1.0→1.08 + horizontal pan -15px→+15px
 *   - Blurred background fill to eliminate black bars for non-9:16 images
 *   - Strong bottom gradient mask so subtitle text is always readable
 */
export const NewsPhoto: React.FC<Props> = ({ imageUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns zoom
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  // Horizontal drift
  const translateX = interpolate(frame, [0, durationInFrames], [-15, 15], {
    extrapolateRight: "clamp",
  });

  // Content zone height in px
  const contentHeight = CONTENT_MAX_BOTTOM; // 1440

  if (!imageUrl) {
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
        {/* Subtle grid pattern */}
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: 0.08,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
    );
  }

  const imgSrc = imageUrl.startsWith("http") ? imageUrl : staticFile(imageUrl);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: FRAME_WIDTH,
        height: contentHeight, // CLIPPED — does NOT go into subtitle zone
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Background blur fill — eliminates black bars */}
      <Img
        src={imgSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(35%)",
          transform: "scale(1.15)",
        }}
      />

      {/* Foreground image with Ken Burns */}
      <Img
        src={imgSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${translateX}px)`,
          transformOrigin: "center center",
        }}
      />

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 180px rgba(0,0,0,0.75)",
        }}
      />

      {/* Bottom gradient mask — blends into subtitle zone */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.95) 100%)",
        }}
      />
    </div>
  );
};
