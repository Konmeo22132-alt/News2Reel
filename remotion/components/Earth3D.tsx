import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Earth3D: React.FC<{
  focusLocation: string;
  zoomLevel: number;
  dangerZone?: boolean;
}> = ({ focusLocation, zoomLevel, dangerZone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14 },
  });

  const scale = interpolate(entrance, [0, 1], [0.5, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
      className="w-[900px] h-[900px] bg-[#02020a] rounded-full shadow-[0_0_100px_rgba(0,100,255,0.4)] border-4 border-blue-900/50 relative overflow-hidden flex items-center justify-center p-12 flex-col gap-6"
    >
      <div className="absolute inset-0 bg-blue-500/10 mix-blend-screen opacity-50 animate-pulse"></div>
      
      <div className="relative z-10 w-48 h-48 rounded-full border-2 border-dashed border-cyan-500 animate-[spin_10s_linear_infinite] flex items-center justify-center">
        <div className="w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_20px_cyan] absolute top-[-8px]"></div>
      </div>
      
      <div className="relative z-10 text-center">
        <h1 className="text-6xl font-bold font-sans text-cyan-400 tracking-wider">
          {focusLocation.toUpperCase()}
        </h1>
        {dangerZone && (
          <div className="mt-4 px-6 py-2 bg-red-600/20 border border-red-500 text-red-500 rounded-full font-bold text-2xl uppercase tracking-widest inline-flex items-center gap-3">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
            Critical Zone
          </div>
        )}
      </div>

      <div className="absolute bottom-20 flex gap-4 text-cyan-300 font-mono text-xl z-10">
        <div>LAT: 25.276987</div>
        <div>LON: 55.296249</div>
        <div>ZOOM: {zoomLevel.toFixed(1)}X</div>
      </div>
    </div>
  );
};
