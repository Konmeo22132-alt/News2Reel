import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const NewsPhoto: React.FC<{ imageUrl?: string }> = ({ imageUrl }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Smooth, precise Ken Burns zoom effect (1.0 to 1.1 scale)
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateRight: "clamp",
  });

  if (!imageUrl) {
    return (
      <AbsoluteFill className="bg-gradient-to-b from-[#0a0f18] to-[#020408] flex items-center justify-center">
        <div className="w-full h-full opacity-10" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: '40px 40px' }} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill className="bg-black flex items-center justify-center overflow-hidden">
        {/* Background Blur Layer to eliminate black bars for non-16:9 images */}
        <AbsoluteFill>
            <Img 
                src={imageUrl.startsWith("http") ? imageUrl : `/${imageUrl}`} 
                style={{ 
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(40px) brightness(40%)",
                    transform: `scale(1.2)`
                }} 
            />
        </AbsoluteFill>

        {/* Foreground Focus Layer */}
        <Img 
            src={imageUrl.startsWith("http") ? imageUrl : `/${imageUrl}`} 
            style={{ 
                transform: `scale(${scale})`,
                width: "100%",
                height: "80%", // Keep central focus
                objectFit: "contain",
            }} 
        />
        
        {/* Cinematic Vignette & Bottom Mask for Text Readability */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 150px rgba(0,0,0,0.8)' }} />
        <div className="absolute bottom-0 w-full h-[60%] bg-gradient-to-t from-black via-black/60 to-transparent" />
    </AbsoluteFill>
  );
};
