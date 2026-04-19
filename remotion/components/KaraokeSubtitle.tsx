import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const KaraokeSubtitle: React.FC<{ narration: string }> = ({ narration }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Split narration into individual words
  const words = narration.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // Approximate duration of each word
  const framesPerWord = durationInFrames / words.length;

  return (
    <AbsoluteFill className="p-8 flex items-end justify-center pb-32">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 max-w-[90%] text-center line-clamp-3 leading-tight" style={{ 
            textShadow: '0 4px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.6)',
            fontSize: '85px',
            fontWeight: 800
        }}>
        {words.map((word, index) => {
          // Determine the start frame for this specific word
          const wordStartFrame = index * framesPerWord;
          
          // Bouncing entrance: scale from 0 to 120% to 100%
          // Only triggers when the frame cursor reaches wordStartFrame
          const entranceScale = spring({
            frame: Math.max(0, frame - wordStartFrame),
            fps,
            config: { damping: 10, mass: 1, stiffness: 100 },
          });

          // Optional highlight logic (simulating the <keyword> replacement color)
          // We can highlight uppercase words, numbers, or specific punctuation
          const isHighlight = word.toUpperCase() === word || /\d/.test(word) || word.length > 7;

          // If the word hasn't appeared yet, hide it to sync with audio
          const opacity = frame >= wordStartFrame ? 1 : 0;

          return (
            <span
              key={index}
              style={{
                opacity,
                transform: `scale(${entranceScale})`,
                color: isHighlight ? '#fcd34d' : 'white', // yellow-300 for highlights
                display: 'inline-block',
                willChange: 'transform, opacity'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
