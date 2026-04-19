import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const WarningAlert: React.FC<{
  text: string;
}> = ({ text }) => {
  const frame = useCurrentFrame();

  // Flashing red state
  const isFlashing = frame % 10 < 5;

  return (
    <AbsoluteFill className="flex items-center justify-center bg-transparent">
      {/* Background tint under warning */}
      <div 
        className="absolute inset-0 bg-red-900/40 mix-blend-multiply"
        style={{ opacity: isFlashing ? 1 : 0.4 }}
      />

      {/* Screen Border Flash */}
      <div 
        className="absolute inset-0 border-[30px] border-red-600 transition-opacity duration-75 pointer-events-none"
        style={{ opacity: isFlashing ? 1 : 0, boxShadow: 'inset 0 0 100px rgba(255,0,0,0.8)' }}
      />

      {/* Warning Tape Top & Bottom */}
      <div className="absolute top-0 w-[200%] h-16 bg-yellow-400 rotate-2 translate-x-[-10%] flex overflow-hidden opacity-90 shadow-xl border-y-4 border-black z-20">
         <div className="w-full h-full" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 30px, #fbbf24 30px, #fbbf24 60px)' }}></div>
      </div>
      <div className="absolute bottom-0 w-[200%] h-16 bg-yellow-400 -rotate-2 translate-x-[-10%] flex overflow-hidden opacity-90 shadow-xl border-y-4 border-black z-20">
         <div className="w-full h-full" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #000, #000 30px, #fbbf24 30px, #fbbf24 60px)' }}></div>
      </div>

      <div className="z-10 bg-black/80 backdrop-blur-md border px-20 py-8 border-red-500 rounded-3xl shadow-[0_0_100px_red]">
        <h1 className="text-8xl font-black text-red-500 uppercase tracking-widest text-center animate-pulse"
            style={{ textShadow: '0 0 20px red' }}>
          ⚠️ {text}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
