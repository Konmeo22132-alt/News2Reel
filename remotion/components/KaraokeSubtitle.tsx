import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ZONES, FRAME_WIDTH, FRAME_HEIGHT, FONT_SIZES } from "../constants/layout";

interface Props {
  narration: string;
}

/**
 * KaraokeSubtitle — 4-word group karaoke, Google Podcast style.
 *
 * Rules:
 *   ✅ Position: ABSOLUTE bottom of SubtitleZone (never moves, never overlaps content)
 *   ✅ Groups of 4 words always visible
 *   ✅ Active word: white/yellow (keyword), bold, slightly larger
 *   ✅ Past words: slightly dimmed gray
 *   ✅ Future words: dark gray
 *   ✅ Semi-transparent background bar for legibility on any image
 */
export const KaraokeSubtitle: React.FC<Props> = ({ narration }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

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

  // Fade in the very first group, fade out last group
  const isFirstGroup = activeGroupStart === 0;
  const isLastGroup  = activeGroupStart + WORDS_PER_GROUP >= parsedWords.length;
  const groupStartFrame = activeGroupStart * framesPerWord;
  const groupEndFrame   = (activeGroupStart + WORDS_PER_GROUP) * framesPerWord;

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
        // Anchor to SubtitleZone: top of subtitle zone + padding
        top: ZONES.subtitle.y + 20,
        height: ZONES.subtitle.height - 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 24,
        paddingLeft: 48,
        paddingRight: 48,
        opacity,
        zIndex: 100, // Always on top
      }}
    >
      {/* Semi-transparent background bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.88) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
          gap: "0 20px",
          maxWidth: FRAME_WIDTH - 96,
          textAlign: "center",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 900,
          lineHeight: 1.2,
          zIndex: 1,
        }}
      >
        {group.map((word, localIdx) => {
          const globalIdx = activeGroupStart + localIdx;
          const isActive  = globalIdx === activeWordIdx;
          const isPast    = globalIdx < activeWordIdx;
          // isFuture = !isActive && !isPast

          let color: string;
          let fontSize: number;
          let textShadow: string;

          if (isActive) {
            if (word.isKeyword) {
              color      = "#FFD700"; // Gold for keywords being spoken
              fontSize   = FONT_SIZES.subtitle + 10;
              textShadow = "0 0 20px rgba(255,215,0,0.7), 4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000";
            } else {
              color      = "#FFFFFF";
              fontSize   = FONT_SIZES.subtitle + 6;
              textShadow = "4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 0 8px 20px rgba(0,0,0,0.9)";
            }
          } else if (isPast) {
            color      = "rgba(200,200,200,0.65)";
            fontSize   = FONT_SIZES.subtitle - 4;
            textShadow = "2px 2px 0 #000";
          } else {
            // Future
            color      = "rgba(130,130,130,0.5)";
            fontSize   = FONT_SIZES.subtitle - 6;
            textShadow = "none";
          }

          return (
            <span
              key={localIdx}
              style={{
                color,
                fontSize,
                textShadow,
                transition: "color 0.1s ease, font-size 0.1s ease",
                display: "inline-block",
                letterSpacing: "-1px",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
