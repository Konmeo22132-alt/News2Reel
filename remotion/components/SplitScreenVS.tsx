import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const SplitScreenVS: React.FC<{
  leftTitle: string;
  rightTitle: string;
}> = ({ leftTitle, rightTitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill className="flex flex-row bg-black overflow-hidden relative">
      <div 
        className="w-1/2 h-full justify-center flex items-center bg-gradient-to-br from-blue-900 via-blue-950 to-black relative border-r-8 border-yellow-500 z-10"
        style={{ transform: `translateX(${(1 - entrance) * -100}%)` }}
      >
        <h2 className="text-8xl font-black text-blue-300 uppercase transform -rotate-90 md:rotate-0 tracking-tighter text-shadow-xl"
            style={{ textShadow: '4px 4px 0 #000' }}>
          {leftTitle}
        </h2>
      </div>

      <div 
        className="w-1/2 h-full justify-center flex items-center bg-gradient-to-bl from-red-900 via-red-950 to-black relative z-0"
        style={{ transform: `translateX(${(1 - entrance) * 100}%)` }}
      >
        <h2 className="text-8xl font-black text-red-300 uppercase transform rotate-90 md:rotate-0 tracking-tighter text-shadow-xl"
             style={{ textShadow: '4px 4px 0 #000' }}>
          {rightTitle}
        </h2>
      </div>

      {/* VS Badge */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        style={{ transform: `translate(-50%, -50%) scale(${entrance})` }}
      >
        <div className="w-48 h-48 bg-yellow-500 rounded-full flex items-center justify-center border-8 border-black shadow-[0_0_50px_rgba(255,215,0,0.5)]">
          <span className="text-7xl font-black italic text-black">VS</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
