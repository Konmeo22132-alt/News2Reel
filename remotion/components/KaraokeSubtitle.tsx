import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { ZONES, FRAME_WIDTH, FONT_SIZES } from "../constants/layout";

interface Props {
  narration: string;
}

/**
 * KaraokeSubtitle v2 — Dynamic karaoke with keyword punch.
 *
 * Improvements over v1:
 *   ✨ Active word has BOUNCE entrance (spring animation)
 *   ✨ Keywords SCALE UP 150% + intense glow when spoken
 *   ✨ Group transitions have slide animation (not just opacity)
 *   ✨ Active word indicator bar (underline that travels)
 *   ✨ Better contrast with frosted glass background
 */
export const KaraokeSubtitle: React.FC<Props> = ({ narration }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // ── Parse narration into words with keyword flag ──────────────────────────
  const parsedWords: { text: string; isKeyword: boolean }[] = [];
  const parts = narration.split(/(<keyword>.*?<\/keyword>)/gi);
  parts.forEach((part) => {
    if (part.toLowerCase().startsWith("<keyword>")) {
      const content = part.replace(/<\/?keyword>/gi, "");
      content.split(/\s+/).filter(Boolean).forEach((w) =>
        parsedWords.push({ text: w, isKeyword: true })
      );
    } else {
      part.split(/\s+/).filter(Boolean).forEach((w) =>
        parsedWords.push({ text: w, isKeyword: false })
      );
    }
  });

  if (parsedWords.length === 0) return null;

  const WORDS_PER_GROUP = 4;
  const framesPerWord = durationInFrames / parsedWords.length;

  // Determine active word index from frame
  const activeWordIdx = Math.min(
    Math.floor(frame / framesPerWord),
    parsedWords.length - 1
  );

  // Which group is currently active?
  const activeGroupStart = Math.floor(activeWordIdx / WORDS_PER_GROUP) * WORDS_PER_GROUP;
  const group = parsedWords.slice(activeGroupStart, activeGroupStart + WORDS_PER_GROUP);

  // ── Group transition animation ────────────────────────────────────────────
  const groupStartFrame = activeGroupStart * framesPerWord;
  const groupEndFrame = (activeGroupStart + WORDS_PER_GROUP) * framesPerWord;
  const isFirstGroup = activeGroupStart === 0;
  const isLastGroup = activeGroupStart + WORDS_PER_GROUP >= parsedWords.length;

  // Slide + fade entrance
  const entranceProgress = interpolate(
    frame,
    [groupStartFrame, groupStartFrame + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const slideY = interpolate(entranceProgress, [0, 1], [25, 0], {
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(
    frame,
    isFirstGroup
      ? [groupStartFrame, groupStartFrame + 6, groupEndFrame - 5, groupEndFrame]
      : isLastGroup
      ? [groupStartFrame, groupStartFrame + 4, groupEndFrame - 8, groupEndFrame]
      : [groupStartFrame, groupStartFrame + 4, groupEndFrame - 4, groupEndFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // Anchor to SubtitleZone
        top: ZONES.subtitle.y,
        height: ZONES.subtitle.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 28,
        paddingLeft: 40,
        paddingRight: 40,
        opacity,
        transform: `translateY(${slideY}px)`,
        zIndex: 100,
      }}
    >
      {/* Frosted glass background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to bottom, rgba(5,5,16,0.82) 0%, rgba(5,5,16,0.95) 100%)",
          borderTop: "2px solid rgba(255,255,255,0.08)",
        }}
      />

      {/* Word group */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "4px 18px",
          maxWidth: FRAME_WIDTH - 80,
          textAlign: "center",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900,
          lineHeight: 1.25,
          zIndex: 1,
        }}
      >
        {group.map((word, localIdx) => {
          const globalIdx = activeGroupStart + localIdx;
          const isActive = globalIdx === activeWordIdx;
          const isPast = globalIdx < activeWordIdx;
          
          // Frame when this specific word becomes active
          const wordActivateFrame = globalIdx * framesPerWord;
          const wordLocalFrame = frame - wordActivateFrame;

          // Bounce entrance for active word
          const wordScale = isActive
            ? spring({
                frame: Math.max(0, wordLocalFrame),
                fps,
                config: { damping: 10, mass: 0.8, stiffness: 300 },
              })
            : 1;

          let color: string;
          let fontSize: number;
          let textShadow: string;
          let transform: string;
          let extraGlow = "";

          if (isActive) {
            if (word.isKeyword) {
              // 🔥 KEYWORD PUNCH — scale up + intense glow
              color = "#FFD700";
              fontSize = FONT_SIZES.subtitle + 14;
              textShadow = "0 0 30px rgba(255,215,0,0.9), 0 0 60px rgba(255,215,0,0.4), 4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000";
              transform = `scale(${0.6 + wordScale * 0.6})`;
              extraGlow = "drop-shadow(0 0 20px rgba(255,215,0,0.5))";
            } else {
              color = "#FFFFFF";
              fontSize = FONT_SIZES.subtitle + 8;
              textShadow = "4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 0 8px 25px rgba(0,0,0,0.9)";
              transform = `scale(${0.85 + wordScale * 0.15})`;
              extraGlow = "";
            }
          } else if (isPast) {
            color = "rgba(200,200,200,0.55)";
            fontSize = FONT_SIZES.subtitle - 4;
            textShadow = "2px 2px 0 rgba(0,0,0,0.5)";
            transform = "scale(1)";
          } else {
            // Future
            color = "rgba(100,100,120,0.4)";
            fontSize = FONT_SIZES.subtitle - 6;
            textShadow = "none";
            transform = "scale(0.95)";
          }

          return (
            <span
              key={localIdx}
              style={{
                color,
                fontSize,
                textShadow,
                transform,
                filter: extraGlow || "none",
                display: "inline-block",
                letterSpacing: "-1px",
                transition: "color 0.08s, transform 0.08s",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>

      {/* Active word indicator bar */}
      <div
        style={{
          position: "relative",
          width: 200,
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.08)",
          marginTop: 20,
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            background: "linear-gradient(90deg, #6366f1, #818cf8)",
            width: `${((activeWordIdx % WORDS_PER_GROUP) / Math.max(group.length - 1, 1)) * 100}%`,
            transition: "width 0.15s ease-out",
            boxShadow: "0 0 10px rgba(99,102,241,0.5)",
          }}
        />
      </div>
    </div>
  );
};
