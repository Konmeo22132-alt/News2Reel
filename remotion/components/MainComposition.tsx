import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { ScriptTemplate } from "../Root";
import { ZONES, FRAME_WIDTH, FRAME_HEIGHT, FONT_SIZES, ANIM } from "../constants/layout";

// Shared layers
import { NewsPhoto } from "./NewsPhoto";
import { KaraokeSubtitle } from "./KaraokeSubtitle";

// ✨ NEW: Cinematic hook + transitions
import { HookScene } from "./HookScene";
import { SceneEntrance, SceneExit, getTransitionType } from "./SceneTransition";

// Animation overlays (render inside ContentZone only)
import { SocialTweet } from "./SocialTweet";
import { Earth3D } from "./Earth3D";
import { HackerTerminal } from "./HackerTerminal";
import { ImpactCallout } from "./ImpactCallout";
import { PointToPoint } from "./PointToPoint";
import { SplitScreenVS } from "./SplitScreenVS";
import { DataChart } from "./DataChart";
import { WarningAlert } from "./WarningAlert";

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

// ─── Film Grain Overlay ──────────────────────────────────────────────────────
// Subtle animated noise that makes everything feel "cinematic"

const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  // Shift grain pattern every frame for animation
  const offsetX = (frame * 37) % 200;
  const offsetY = (frame * 53) % 200;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        pointerEvents: "none",
        opacity: 0.06,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        mixBlendMode: "overlay",
      }}
    />
  );
};

// ─── Cinematic Vignette (persistent) ─────────────────────────────────────────

const CinematicVignette: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      zIndex: 85,
      pointerEvents: "none",
      boxShadow: "inset 0 0 250px rgba(0,0,0,0.65)",
    }}
  />
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
 * v0.2.0 Enhancements:
 *   ✨ HookScene for first scene (flash + zoom burst + camera shake + title slam)
 *   ✨ SceneTransition between scenes (zoom/glitch/whip/fade cycling)
 *   ✨ Film grain overlay for cinematic feel
 *   ✨ Persistent cinematic vignette
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

      {/* ── Persistent Layers (always visible) ── */}
      <Watermark username={script.fake_username || "TheInvestigator"} />
      <CinematicVignette />
      <FilmGrain />

      {/* ── Scenes ── */}
      {script.scenes.map((scene, index) => {
        const startFrame = frameCursor;
        const duration = scene.durationInFrames || 150;
        frameCursor += duration;
        const isFirstScene = index === 0;
        const isLastScene = index === script.scenes.length - 1;
        const transitionType = getTransitionType(index);

        return (
          <Sequence key={index} from={startFrame} durationInFrames={duration}>
            {/* ── Layer 1: Full-screen image (clipped at content zone bottom) ── */}
            <NewsPhoto imageUrl={scene.imageUrl} />

            {/* ── Layer 2: Hook Scene OR Animation Overlay ── */}
            {isFirstScene && scene.isHook ? (
              // ✨ NEW: Cinematic hook for first scene
              <HookScene
                title={script.clickbait_title}
                hook={script.hook}
              />
            ) : (
              <>
                {/* ── Animation overlays — ContentZone only ── */}
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
              </>
            )}

            {/* ── Layer 3: Scene Transitions ── */}
            {/* Entrance: fade-from-black (skip for first scene — HookScene handles its own) */}
            {!isFirstScene && <SceneEntrance type="fade" />}
            {/* Exit: cinematic transition (skip for last scene) */}
            {!isLastScene && <SceneExit type={transitionType} />}

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
