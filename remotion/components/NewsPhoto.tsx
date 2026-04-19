import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const NewsPhoto: React.FC<{ imageUrl?: string }> = ({ imageUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Subtle Ken Burns zoom effect (1.0 to 1.1 scale)
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  // Entrance pop
  const entrance = spring({
    frame,
    fps,
    config: { damping: 100, mass: 2 },
  });

  if (!imageUrl) {
    return (
      <AbsoluteFill className="bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
        <div className="w-full h-full opacity-30" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, #1f2937 10px, #1f2937 20px)" }} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill className="bg-black flex items-center justify-center overflow-hidden">
        <Img 
            src={imageUrl.startsWith("http") ? imageUrl : `/${imageUrl}`} 
            style={{ 
                transform: `scale(${scale * entrance})`,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.6
            }} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80" />
    </AbsoluteFill>
  );
};
