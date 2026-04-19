import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { ScriptTemplate } from "../Root";
import { SocialTweet } from "./SocialTweet";
import { Earth3D } from "./Earth3D";
import { HackerTerminal } from "./HackerTerminal";
import { NewsPhoto } from "./NewsPhoto";
import { KaraokeSubtitle } from "./KaraokeSubtitle";

export const MainComposition: React.FC<{ script: ScriptTemplate }> = ({ script }) => {
  let frameCursor = 0;

  return (
    <AbsoluteFill className="bg-[#050510] text-white font-sans overflow-hidden">
      {/* Fallback BGM across the entire video if needed */}
      <Audio 
         src={staticFile("assets/bgm/tech-future.mp3")} 
         volume={(f) => Math.max(0.1, 0.3 - (f / 1000))} 
      />

      {script.scenes.map((scene, index) => {
        const startFrame = frameCursor;
        const duration = scene.durationInFrames || 150;
        frameCursor += duration;

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={duration}
          >
            <AbsoluteFill className="flex items-center justify-center">
              
              {/* Layer 1: Background Base & Scraped Images (Ken Burns effect) */}
              <NewsPhoto imageUrl={scene.imageUrl} />
              
              {/* Layer 2: Social Embeds & Special Overlays */}
              <AbsoluteFill className="flex items-center justify-center opacity-90">
                {scene.animationType === "SocialTweet" && (
                  <SocialTweet
                    metadata={{
                      clickbait_title: script.clickbait_title,
                      fake_username: script.fake_username,
                      context_image_url: script.context_image_url || ""
                    }}
                    {...scene.animationProps}
                  />
                )}
                {scene.animationType === "Earth3D" && (
                  <Earth3D {...scene.animationProps} />
                )}
                {scene.animationType === "HackerTerminal" && (
                  <HackerTerminal {...scene.animationProps} />
                )}
              </AbsoluteFill>

              {/* Layer 3: Audio TTS */}
              {scene.audioUrl && (
                  <Audio src={staticFile(scene.audioUrl)} />
              )}

              {/* Layer 4: Bouncing Karaoke Subtitles mapped directly to Audio length */}
               <KaraokeSubtitle narration={scene.narration} />

            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
