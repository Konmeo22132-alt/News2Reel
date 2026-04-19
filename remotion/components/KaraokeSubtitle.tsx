import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const KaraokeSubtitle: React.FC<{ narration: string }> = ({ narration }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Split narration into individual words
  const words = narration.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return null;

  // Approximate duration of each word
  const framesPerWord = durationInFrames / words.length;

  return (
    <AbsoluteFill className="p-10 flex items-end justify-center pb-40">
      <div 
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 max-w-[95%] text-center line-clamp-3 leading-tight" 
        style={{ 
            fontFamily: "'Outfit', sans-serif",
            fontSize: '95px',
            fontWeight: 900
        }}>
        {words.map((word, index) => {
          const wordStartFrame = index * framesPerWord;
          
          // Crisp 2D Bounce entrance: scale from 0 to 125% to 100%
          const entranceScale = spring({
            frame: Math.max(0, frame - wordStartFrame),
            fps,
            config: { damping: 11, mass: 1, stiffness: 180 },
          });

          // Highlight logic
          const isHighlight = word.toUpperCase() === word || /\d/.test(word) || word.length > 7;

          // Standard outline + heavy drop shadow for intense clarity against any image
          const outlineShadow = `
             3px 3px 0 #000, 
            -3px -3px 0 #000, 
             3px -3px 0 #000, 
            -3px 3px 0 #000,
             0 8px 30px rgba(0,0,0,0.95),
             0 0 25px rgba(0,0,0,0.6)
          `;

          const opacity = frame >= wordStartFrame ? 1 : 0;

          return (
            <span
              key={index}
              style={{
                opacity,
                transform: `scale(${entranceScale})`,
                color: isHighlight ? '#FFD700' : '#FFFFFF', // Clean flat Gold or White
                textShadow: outlineShadow,
                display: 'inline-block',
                willChange: 'transform, opacity',
                letterSpacing: '-1px'
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
