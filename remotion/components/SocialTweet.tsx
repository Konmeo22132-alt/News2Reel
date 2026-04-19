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

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180 },
  });

  return (
    <div
      style={{
        transform: `translateY(${(1 - entrance) * 100}px) scale(${
          0.95 + entrance * 0.05
        })`,
        opacity: entrance,
        // High-end frosted glass effect
        background: 'rgba(20, 25, 40, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05) inset'
      }}
      className="rounded-[32px] w-[950px] p-10 flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-full flex items-center justify-center font-bold text-4xl shadow-lg border-2 border-white/20">
          {metadata.fake_username.charAt(0)}
        </div>
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            {metadata.fake_username}
          </h2>
          <p className="text-blue-300/80 text-2xl font-medium mt-1">@investigator_news</p>
        </div>
      </div>

      {/* Body Text */}
      <div className="text-[44px] leading-[1.3] font-semibold text-white/95 mt-2">
        {tweetText}
      </div>

      {/* Image Context (if available) */}
      <div className="w-full min-h-[400px] h-auto max-h-[600px] rounded-[24px] overflow-hidden mt-2 relative border border-white/10 shadow-inner bg-black/40">
        <Img
          src={metadata.context_image_url.startsWith("http") ? metadata.context_image_url : `/${metadata.context_image_url}`}
          className="w-full h-full object-cover"
        />
        {/* Sleek bottom gradient for the title context */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pt-12">
          <p className="text-[32px] font-bold text-white leading-tight drop-shadow-md">
            {metadata.clickbait_title}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-14 text-white/60 text-3xl font-medium mt-4 border-t border-white/10 pt-6">
        <div className="flex items-center gap-4">
          <svg className="w-10 h-10 fill-current text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {likes}
        </div>
        <div className="flex items-center gap-4">
          <svg className="w-10 h-10 fill-current text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" viewBox="0 0 24 24">
            <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4 7.58 4 4 7.58 4 12H1l4 4 4-4H6z"/>
          </svg>
          {retweets}
        </div>
      </div>
    </div>
  );
};
