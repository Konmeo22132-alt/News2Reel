import React from "react";
import { Img, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const SocialTweet: React.FC<{
  metadata: { clickbait_title: string; fake_username: string; context_image_url: string };
  tweetText: string;
  likes: string;
  retweets: string;
}> = ({ metadata, tweetText, likes, retweets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <div
      style={{
        transform: `translateY(${(1 - entranceProgress) * 500}px) scale(${
          0.9 + entranceProgress * 0.1
        })`,
        opacity: entranceProgress,
      }}
      className="bg-[#15202b] rounded-2xl w-[900px] border border-gray-800 shadow-2xl p-8 flex flex-col gap-6"
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-2xl">
          {metadata.fake_username.charAt(0)}
        </div>
        <div>
          <h2 className="text-3xl font-bold font-sans text-white">
            {metadata.fake_username}
          </h2>
          <p className="text-gray-400 text-xl">@investigator_news</p>
        </div>
      </div>

      <div className="text-4xl leading-tight font-medium text-gray-100">
        {tweetText}
      </div>

      <div className="w-full h-[500px] rounded-2xl overflow-hidden mt-4 relative border border-gray-800">
        <Img
          src={metadata.context_image_url}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 w-full bg-black/70 backdrop-blur-md p-4 border-t border-gray-800">
          <p className="text-2xl font-bold text-white line-clamp-1">
            {metadata.clickbait_title}
          </p>
        </div>
      </div>

      <div className="flex gap-12 text-gray-400 text-2xl font-medium mt-2">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 fill-current text-red-500" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {likes}
        </div>
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 fill-current text-green-500" viewBox="0 0 24 24">
            <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4 7.58 4 4 7.58 4 12H1l4 4 4-4H6z"/>
          </svg>
          {retweets}
        </div>
      </div>
    </div>
  );
};
