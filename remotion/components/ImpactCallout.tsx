import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const ImpactCallout: React.FC<{
  text: string;
  subtext?: string;
}> = ({ text, subtext }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Violent entrance slam
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, mass: 2, stiffness: 200 },
  });

  const opacity = interpolate(scale, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Background pulsing overlay
  const bgOpacity = interpolate(
    Math.sin(frame / 5),
    [-1, 1],
    [0.3, 0.7]
  );

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center relative overflow-hidden bg-black">
      {/* Dynamic Background Noise/Flash */}
      <div 
        className="absolute inset-0 bg-red-900/40 mix-blend-screen"
        style={{ opacity: bgOpacity }}
      />
      
      {/* Glitchy/Slam text container */}
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          opacity,
          textShadow: '0 20px 50px rgba(255,0,0,0.8)'
        }}
        className="flex flex-col items-center z-10 p-8"
      >
        <h1 
          className="font-black text-white leading-none text-center transform -skew-x-6 tracking-tighter"
          style={{ 
            fontSize: '180px',
            WebkitTextStroke: '4px #fff'
          }}
        >
          {text.toUpperCase()}
        </h1>
        
        {subtext && (
          <div 
            className="mt-6 px-10 py-4 bg-yellow-500 text-black font-black text-5xl uppercase tracking-widest transform skew-x-12 shadow-[10px_10px_0_#ff0000]"
          >
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
