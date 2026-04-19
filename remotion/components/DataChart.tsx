import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const DataChart: React.FC<{
  items: { label: string; val: number }[];
}> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxVal = Math.max(...items.map(i => i.val));

  return (
    <AbsoluteFill className="bg-[#111] p-16 flex flex-col justify-end">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#fff_1px,transparent_1px)] bg-[size:100%_10%]" />

      <div className="flex flex-row items-end justify-center gap-12 w-full h-[70%] z-10 relative border-b-4 border-gray-600">
        {items.map((item, index) => {
          const heightPct = (item.val / maxVal) * 100;
          
          const barHeight = spring({
            frame: frame - index * 10, // Staggered animation
            fps,
            config: { damping: 12 },
          });

          return (
            <div key={index} className="flex flex-col items-center gap-6" style={{ height: '100%', justifyContent: 'flex-end' }}>
              {/* Value floating above bar */}
              <div 
                className="text-5xl font-bold font-mono text-white bg-black/50 px-4 py-2 rounded border border-white/20"
                style={{ opacity: barHeight, transform: `translateY(${(1 - barHeight) * 20}px)` }}
              >
                {Math.round(item.val * barHeight)}
              </div>
              
              {/* The Bar */}
              <div 
                className="w-40 bg-gradient-to-t from-emerald-900 to-emerald-400 border-2 border-emerald-300 rounded-t-xl relative overflow-hidden"
                style={{ 
                  height: `${heightPct * barHeight}%`,
                  boxShadow: '0 0 30px rgba(52,211,153,0.3)',
                  transformOrigin: 'bottom'
                }}
              >
                {/* Shine effect inside bar */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-[200%] -translate-x-[100%] animate-[scan_2s_linear_infinite]" />
              </div>
              
              {/* Label */}
              <span className="text-4xl font-bold text-gray-300 uppercase tracking-widest text-center h-20 flex items-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
