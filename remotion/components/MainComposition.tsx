import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { ScriptTemplate } from "../Root";
import { ZONES, FRAME_WIDTH, FRAME_HEIGHT, FONT_SIZES, ANIM } from "../constants/layout";

// Shared layers
import { NewsPhoto } from "./NewsPhoto";
import { KaraokeSubtitle } from "./KaraokeSubtitle";

// Animation overlays (render inside ContentZone only)
import { SocialTweet } from "./SocialTweet";
import { Earth3D } from "./Earth3D";
import { HackerTerminal } from "./HackerTerminal";
import { ImpactCallout } from "./ImpactCallout";
import { PointToPoint } from "./PointToPoint";
import { SplitScreenVS } from "./SplitScreenVS";
import { DataChart } from "./DataChart";
import { WarningAlert } from "./WarningAlert";

// ─── Breaking News Top Banner ────────────────────────────────────────────────

const TopBanner: React.FC<{ title: string; isHook?: boolean }> = ({ title, isHook }) => {
  const frame = useCurrentFrame();
  const slideY = interpolate(frame, [0, 12], [-80, 0], {
    extrapolateRight: "clamp",
    easing: ANIM.easing,
  });
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  if (!isHook) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: ZONES.top.y + 24,
        left: 32,
        right: 32,
        transform: `translateY(${slideY}px)`,
        opacity,
        zIndex: 50,
      }}
    >
      {/* BREAKING NEWS label */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          background: "#E53935",
          borderRadius: 6,
          paddingLeft: 16,
          paddingRight: 20,
          paddingTop: 8,
          paddingBottom: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            animation: "pulse 1s infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: FONT_SIZES.label,
            color: "#fff",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Breaking News
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900,
          fontSize: FONT_SIZES.title - 4,
          color: "#fff",
          lineHeight: 1.25,
          textShadow: "3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000",
          maxWidth: FRAME_WIDTH - 64,
        }}
      >
        {title}
      </div>
    </div>
  );
};

// ─── Watermark ───────────────────────────────────────────────────────────────

const Watermark: React.FC<{ username: string }> = ({ username }) => (
  <div
    style={{
      position: "absolute",
      top: ZONES.top.y + (ZONES.top.height - 30) / 2,
      right: 32,
      opacity: 0.55,
      zIndex: 60,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <div
      style={{
        width: 4,
        height: 4,
        borderRadius: "50%",
        background: "#E53935",
      }}
    />
    <span
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 700,
        fontSize: FONT_SIZES.tag,
        color: "#fff",
        letterSpacing: 1,
      }}
    >
      @{username}
    </span>
  </div>
);

// ─── Main Composition — The Director ─────────────────────────────────────────

/**
 * MainComposition — Layout Director.
 *
 * Zone layout (1080x1920):
 *   ┌─────────────────────┐ 0px
 *   │   TOP ZONE (280px)  │ ← Breaking news banner, watermark
 *   ├─────────────────────┤ 280px
 *   │                     │
 *   │  CONTENT ZONE       │ ← NewsPhoto (clipped here), animation overlays
 *   │  (1160px)           │
 *   │                     │
 *   ├─────────────────────┤ 1440px
 *   │  SUBTITLE ZONE      │ ← KaraokeSubtitle ONLY
 *   │  (480px)            │
 *   └─────────────────────┘ 1920px
 *
 * Rules enforced here:
 *   1. Animation overlays are wrapped in ContentZone clip
 *   2. KaraokeSubtitle is always rendered last (highest z-index)
 *   3. No component may render below y=1440 except KaraokeSubtitle
 */
export const MainComposition: React.FC<{ script: ScriptTemplate }> = ({ script }) => {
  let frameCursor = 0;

  return (
    <AbsoluteFill
      style={{
        background: "#050510",
        overflow: "hidden",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Global Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap"
        rel="stylesheet"
      />

      {/* ── Persistent Watermark (always visible top-right) ── */}
      <Watermark username={script.fake_username || "TheInvestigator"} />

      {/* ── Scenes ── */}
      {script.scenes.map((scene, index) => {
        const startFrame = frameCursor;
        const duration = scene.durationInFrames || 150;
        frameCursor += duration;

        return (
          <Sequence key={index} from={startFrame} durationInFrames={duration}>
            {/* ── Layer 1: Full-screen image (clipped at content zone bottom) ── */}
            <NewsPhoto imageUrl={scene.imageUrl} />

            {/* ── Layer 2: Top Banner (only on hook scene) ── */}
            <TopBanner title={script.clickbait_title} isHook={scene.isHook} />

            {/* ── Layer 3: Animation overlays — ContentZone only ── */}
            <div
              style={{
                position: "absolute",
                top: ZONES.content.y,
                left: 0,
                width: FRAME_WIDTH,
                height: ZONES.content.height,
                overflow: "hidden", // Hard clip — nothing escapes ContentZone
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {scene.animationType === "SocialTweet" && (
                <SocialTweet
                  metadata={{
                    clickbait_title: script.clickbait_title,
                    fake_username: script.fake_username,
                    context_image_url:
                      script.downloadedImages?.length
                        ? script.downloadedImages[0]
                        : scene.imageUrl || script.context_image_url || "",
                  }}
                  {...scene.animationProps}
                />
              )}
              {scene.animationType === "Earth3D" && <Earth3D {...scene.animationProps} />}
              {scene.animationType === "HackerTerminal" && <HackerTerminal {...scene.animationProps} />}
              {scene.animationType === "ImpactCallout" && <ImpactCallout {...scene.animationProps} />}
              {scene.animationType === "PointToPoint" && <PointToPoint {...scene.animationProps} />}
              {scene.animationType === "SplitScreenVS" && <SplitScreenVS {...scene.animationProps} />}
              {scene.animationType === "DataChart" && <DataChart {...scene.animationProps} />}
              {scene.animationType === "WarningAlert" && <WarningAlert {...scene.animationProps} />}
            </div>

            {/* ── Layer 4: TTS Audio ── */}
            {scene.audioUrl && <Audio src={staticFile(scene.audioUrl)} />}

            {/* ── Layer 5: Karaoke Subtitle — SubtitleZone ONLY, z=100 ── */}
            <KaraokeSubtitle narration={scene.narration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
