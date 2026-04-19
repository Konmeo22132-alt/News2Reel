import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./components/MainComposition";

export type ScriptScene = {
  durationInFrames?: number;
  narration: string;
  animationType?: "SocialTweet" | "Earth3D" | "HackerTerminal" | "NewsPhoto" | string;
  animationProps?: any;
  audioUrl?: string;
  imageUrl?: string;
  isHook?: boolean;
  isCTA?: boolean;
};

export type ScriptTemplate = {
  clickbait_title: string;
  fake_username: string;
  context_image_url?: string;
  downloadedImages?: string[];
  scenes: ScriptScene[];
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AutoVideoComposition"
        component={MainComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          script: {
            clickbait_title: "Mỹ BỐC HƠI 50 TỶ USD Vì Căng Thẳng Trung Đông?",
            fake_username: "The Investigator",
            context_image_url:
              "https://vcdn1-kinhdoanh.vnecdn.net/2024/04/19/trump-hormuz-crisis.jpg",
            scenes: [
              {
                durationInFrames: 120,
                narration:
                  "50 tỷ đô la bốc hơi hoàn toàn khỏi thị trường năng lượng toàn cầu! Nước Mỹ đang thực sự lao đao vì chuỗi cung ứng bị bóp nghẹt tại eo biển Hormuz.",
                animationType: "SocialTweet",
                animationProps: {
                  tweetText: "50 TỶ USD BỐC HƠI! Mỹ Gặp Nguy? 🚨",
                  likes: "14.2K",
                  retweets: "3.5K",
                },
              },
            ],
          } as ScriptTemplate,
        }}
      />
    </>
  );
};
