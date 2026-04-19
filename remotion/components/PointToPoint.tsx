import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const PointToPoint: React.FC<{
  start: string;
  end: string;
  distance: string;
}> = ({ start, end, distance }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Progress of the connection line
  const progress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 200 }, // Smooth, linear-like drawing
    durationInFrames: 60,
  });

  // Fade in distance text after line connects
  const distanceOpacity = interpolate(progress, [0.8, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="bg-[#040814] flex items-center justify-center p-20 overflow-hidden">
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)'
        }}
      />

      <div className="relative w-full h-full flex flex-col items-center justify-center z-10 gap-16">
        
        <div className="flex w-full justify-between items-center px-10 relative">
          
          {/* Start Point */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-400 bg-cyan-900/50 shadow-[0_0_30px_#00f0ff] animate-pulse" />
            <span className="text-4xl font-black text-cyan-300 tracking-widest uppercase bg-black/50 px-4 py-2 border border-cyan-800 backdrop-blur-md">
              {start}
            </span>
          </div>

          {/* Connection Line & Distance */}
          <div className="flex-1 px-8 relative flex items-center justify-center">
            {/* Base Dashed Line */}
            <div className="absolute w-full border-t-4 border-dashed border-gray-600 top-1/2 -translate-y-1/2" />
            
            {/* Animated Solid Line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-cyan-400 to-red-500 shadow-[0_0_20px_red]"
                 style={{ width: `${progress * 100}%` }}
            />

            {/* Distance Readout */}
            <div 
              className="relative z-10 bg-black border-2 border-red-500 text-red-500 px-8 py-3 font-mono font-black text-5xl shadow-[0_0_30px_#ff0000_inset]"
              style={{ opacity: distanceOpacity, transform: `translateY(${interpolate(distanceOpacity, [0, 1], [20, 0])}px)` }}
            >
              {distance}
            </div>
          </div>

          {/* End Point */}
          <div className="flex flex-col items-center gap-4">
            <div 
              className="w-12 h-12 rounded-full border-4 border-red-500 bg-red-900/50 flex items-center justify-center"
              style={{ opacity: progress > 0.9 ? 1 : 0.3, boxShadow: progress > 0.9 ? '0 0 50px red' : 'none' }}
            >
                <div className="w-4 h-4 bg-red-400 rounded-full animate-ping" />
            </div>
            <span 
              className="text-4xl font-black text-red-400 tracking-widest uppercase bg-black/50 px-4 py-2 border border-red-800 backdrop-blur-md"
              style={{ opacity: progress > 0.9 ? 1 : 0.5 }}
            >
              {end}
            </span>
          </div>

        </div>
      </div>
    </AbsoluteFill>
  );
};
