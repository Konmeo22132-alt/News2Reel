import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, interpolate, continueRender, delayRender } from "remotion";
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

// ─── Font Loading (Remotion-safe) ────────────────────────────────────────────
// IMPORTANT: Do NOT use <link> tags for fonts in Remotion components.
// Remotion cannot track external resource loading from <link> → delayRender hangs.
// Use FontFace API with delayRender/continueRender instead.

const FONT_FAMILY = "Outfit, 'Noto Sans', Arial, sans-serif";

// Pre-load font once at module level (outside component to avoid re-loading)
let fontHandle: ReturnType<typeof delayRender> | null = null;
let fontLoaded = false;

function loadOutfitFont(): ReturnType<typeof delayRender> | null {
  if (typeof document === "undefined" || fontLoaded) return null;
  const handle = delayRender("Loading Outfit font");
  const font = new FontFace(
    "Outfit",
    "url(https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2) format('woff2')",
    { weight: "400 900", style: "normal", display: "swap" }
  );
  font.load()
    .then((loaded) => {
      document.fonts.add(loaded);
      fontLoaded = true;
      continueRender(handle);
    })
    .catch(() => {
      // Font failed — continue render with fallback font, don't block
      fontLoaded = true;
      continueRender(handle);
    });
  fontHandle = handle;
  return handle;
}

// Trigger font load
if (typeof document !== "undefined" && !fontLoaded) {
  loadOutfitFont();
}


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

// ─── Film Grain Overlay ──────────────────────────────────────────────────────
// Simple CSS-only grain — no SVG filters (SVG feTurbulence hangs headless Chromium)

const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  // Shift position every frame for animation
  const offsetX = (frame * 37) % 100;
  const offsetY = (frame * 53) % 100;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        pointerEvents: "none",
        opacity: 0.035,
        // Simple repeating gradient that simulates grain — no SVG, no filter
        backgroundImage: [
          `repeating-linear-gradient(${45 + offsetX * 0.5}deg, transparent 0px, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 3px)`,
          `repeating-linear-gradient(${135 + offsetY * 0.5}deg, transparent 0px, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 3px)`,
        ].join(", "),
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
        fontFamily: FONT_FAMILY,
      }}
    >
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
