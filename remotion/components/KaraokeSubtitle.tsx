import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const KaraokeSubtitle: React.FC<{ narration: string }> = ({ narration }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Smart Parser: Bóc tách <keyword>
  const parsedWords: { text: string; isHighlight: boolean }[] = [];
  const parts = narration.split(/(<keyword>.*?<\/keyword>)/gi);
  
  parts.forEach(part => {
    if (part.toLowerCase().startsWith("<keyword>")) {
      const content = part.replace(/<\/?keyword>/gi, "");
      content.split(" ").filter(w => w.trim().length > 0).forEach(w => {
        parsedWords.push({ text: w, isHighlight: true });
      });
    } else {
      part.split(" ").filter(w => w.trim().length > 0).forEach(w => {
        parsedWords.push({ text: w, isHighlight: false });
      });
    }
  });

  if (parsedWords.length === 0) return null;

  // Căn số Frame cho từng chữ dựa trên tổng độ dài thật
  const framesPerWord = durationInFrames / parsedWords.length;

  return (
    <AbsoluteFill className="p-10 flex items-end justify-center pb-32">
      {/* 
        Sử dụng inline-block line-height hẹp để gom cụm chữ. 
        Không dùng flex gap nữa để chữ không bị tràn vỡ Layout HTML.
      */}
      <div 
        className="max-w-[95%] text-center" 
        style={{ 
            fontFamily: "'Outfit', sans-serif",
            fontSize: '92px',
            fontWeight: 900,
            lineHeight: '1.15' // Gum chữ khít lại
        }}>
        {parsedWords.map((item, index) => {
          const wordStartFrame = index * framesPerWord;
          
          const entranceScale = spring({
            frame: Math.max(0, frame - wordStartFrame),
            fps,
            config: { damping: 11, mass: 1, stiffness: 180 },
          });

          const outlineShadow = `
             4px 4px 0 #000, 
            -4px -4px 0 #000, 
             4px -4px 0 #000, 
            -4px 4px 0 #000,
             0 10px 25px rgba(0,0,0,0.9),
             0 0 15px rgba(0,0,0,0.6)
          `;

          const opacity = frame >= wordStartFrame ? 1 : 0;

          return (
            <span
              key={index}
              style={{
                opacity,
                transform: `scale(${entranceScale})`,
                color: item.isHighlight ? '#FFD700' : '#FFFFFF',
                textShadow: outlineShadow,
                display: 'inline-block',
                willChange: 'transform, opacity',
                letterSpacing: '-2px',
                marginRight: '1rem', // Khoảng cách giữa các chữ
                marginBottom: '0.5rem'
              }}
            >
              {item.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
