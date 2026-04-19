import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export const HackerTerminal: React.FC<{
  commandText: string;
  typingSpeed?: "fast" | "normal";
}> = ({ commandText, typingSpeed = "fast" }) => {
  const frame = useCurrentFrame();
  const charsPerFrame = typingSpeed === "fast" ? 2 : 1;
  const visibleLength = Math.min(
    commandText.length,
    Math.floor(frame * charsPerFrame)
  );
  const textToShow = commandText.substring(0, visibleLength);
  const isTyping = visibleLength < commandText.length;

  return (
    <div className="w-[800px] h-[500px] bg-[#0a0a0a] border border-[#333] rounded-2xl shadow-2xl overflow-hidden font-mono text-xl flex flex-col">
      <div className="w-full h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 gap-2">
        <div className="w-4 h-4 rounded-full bg-red-500"></div>
        <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
        <div className="w-4 h-4 rounded-full bg-green-500"></div>
        <span className="ml-4 text-gray-500 text-sm">root@investigator:~</span>
      </div>
      <div className="flex-1 p-8 text-green-400 whitespace-pre-wrap">
        <span>$ </span>
        <span>{textToShow}</span>
        {isTyping && frame % 10 < 5 && (
          <span className="inline-block w-3 h-6 bg-green-400 ml-1 translate-y-1"></span>
        )}
        {!isTyping && (
          <div className="mt-4 text-gray-300">
            [+] Running exploit payload...<br />
            [!] Access Granted.<br />
            [+] Extracting financial records... DONE.<br />
            {frame % 30 < 15 && <span className="inline-block w-3 h-6 bg-green-400 translate-y-1"></span>}
          </div>
        )}
      </div>
    </div>
  );
};
