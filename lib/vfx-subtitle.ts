/**
 * VFX Subtitle Generator — Dynamic ASS + FFmpeg Filter Engine
 *
 * Creates TikTok-style videos with:
 * - Bouncing Karaoke Subtitles (word-by-word scale 120%→100%)
 * - Animated Gradient Backgrounds (shifting radial gradient)
 * - Keyword highlighting with neon glow effects
 * - Terminal/code box overlays
 *
 * Based on SubStation Alpha (ASS) format for FFmpeg processing.
 */

// Color definitions (BGR format for ASS)
export const ASS_COLORS = {
  white: "&H00FFFFFF",
  black: "&H00000000",
  yellow: "&H0000FFFF",    // Highlight: keyword emphasis
  red: "&H000000FF",        // Accent red
  green: "&H00FF00FF",     // Matrix / CTA green
  cyan: "&H00FFFF00",       // Tech cyan
  purple: "&H00FF00FF",
  gray: "&H00808080",
};

// ASS style configuration
export interface ASSStyle {
  font: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  shadowColor: string;
  bold: boolean;
  alignment: number; // 5 = center
}

// Default style for TikTok tech videos
export const DEFAULT_ASS_STYLE: ASSStyle = {
  font: "Roboto Black",
  fontSize: 100,
  primaryColor: ASS_COLORS.white,
  outlineColor: ASS_COLORS.black,
  shadowColor: ASS_COLORS.black,
  bold: true,
  alignment: 5, // Center
};

// ─── Keyword parsing ─────────────────────────────────────────────────────────

export interface ParsedText {
  plain: string;
  keywords: Array<{ word: string; start: number; end: number }>;
}

/**
 * Extract plain text and keyword positions from narration.
 * Keywords are wrapped in <keyword>...</keyword> tags.
 */
export function parseNarration(text: string): ParsedText {
  const plain = text.replace(/<\/?keyword>/gi, "");
  const keywords: ParsedText["keywords"] = [];

  const regex = /<keyword>(.*?)<\/keyword>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    keywords.push({
      word: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return { plain, keywords };
}

// ─── Word timing ─────────────────────────────────────────────────────────────

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

/**
 * Calculate equal-duration word timings across audio duration.
 */
export function calculateWordTimings(text: string, audioDuration: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const avgDuration = audioDuration / words.length;
  const timings: WordTiming[] = [];

  let currentTime = 0;
  for (const word of words) {
    timings.push({ word, start: currentTime, end: currentTime + avgDuration });
    currentTime += avgDuration;
  }

  return timings;
}

// ─── ASS Generation ──────────────────────────────────────────────────────────

/**
 * Generate ASS content for a scene.
 *
 * @param narration  Text with optional <keyword> tags
 * @param audioDuration  Duration in seconds
 * @param style  Optional style overrides
 */
export function generateASSContent(
  narration: string,
  audioDuration: number,
  style: Partial<ASSStyle> = {}
): string {
  const finalStyle = { ...DEFAULT_ASS_STYLE, ...style };
  const { plain, keywords } = parseNarration(narration);

  let ass = generateASSHeader();
  ass += generateStyleSection(finalStyle);
  ass += generateDialogueEvents(plain, keywords, audioDuration, finalStyle);

  return ass;
}

function generateASSHeader(): string {
  return `[Script Info]
Title: TikTok VFX Subtitle
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

`;
}

function generateStyleSection(style: ASSStyle): string {
  // Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour,
  //         OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut,
  //         ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow,
  //         Alignment, MarginL, MarginR, MarginV, Encoding
  return `[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${style.font},${style.fontSize},${style.primaryColor},${style.outlineColor},${style.shadowColor},&H80000000,${style.bold ? -1 : 0},0,0,0,100,100,0,0,4,0,0,${style.alignment},10,10,30,1
Style: Keyword,${style.font},${style.fontSize + 10},${ASS_COLORS.yellow},${style.outlineColor},${style.shadowColor},&H80000000,-1,0,0,0,100,100,0,0,4,0,0,${style.alignment},10,10,30,1

`;
}

function generateDialogueEvents(
  plainText: string,
  keywords: ParsedText["keywords"],
  audioDuration: number,
  style: ASSStyle
): string {
  const words = plainText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const wordDuration = audioDuration / words.length;
  let dialogue = "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n";

  // Group into chunks of 3-4 words for readability
  const chunkSize = 4;
  let time = 0;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const chunkText = chunk.join("\\N");
    const startTime = formatASSTime(time);
    const endTime = formatASSTime(time + wordDuration * chunk.length);

    // Check if any keyword in this chunk
    const hasKeyword = keywords.some((k) =>
      chunk.some((w) => plainText.includes(k.word) && plainText.indexOf(w) >= k.start && plainText.indexOf(w) <= k.end)
    );

    const styleName = hasKeyword ? "Keyword" : "Default";
    dialogue += `Dialogue: 0,${startTime},${endTime},${styleName},,0,0,0,,{\\fad(100,100)\\pos(${style.alignment === 5 ? "540" : "50"},960)}${chunkText}\n`;

    time += wordDuration * chunk.length;
  }

  return dialogue;
}

// ─── Bouncing Karaoke ASS (Retention Booster #1) ─────────────────────────────

/**
 * Generate word-by-word bouncing karaoke ASS subtitles.
 *
 * Effect per word:
 *   t=0ms    → scale 0% (invisible)
 *   t=0-100ms → scale 0%→120% (pop in + overshoot)
 *   t=100-250ms → scale 120%→100% (settle back)
 *   t=end-100ms → scale 100%→0% (fade out)
 *
 * @param narration  Text with optional <keyword> tags
 * @param audioDuration  Total audio duration in seconds
 * @param style  Style overrides (fontSize, color, etc.)
 */
export function generateWordByWordASS(
  narration: string,
  audioDuration: number,
  style: Partial<ASSStyle> = {}
): string {
  const finalStyle = { ...DEFAULT_ASS_STYLE, ...style };
  const { plain, keywords } = parseNarration(narration);
  const timings = calculateWordTimings(plain, audioDuration);

  let ass = generateASSHeader();
  ass += generateStyleSection(finalStyle);
  ass += "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n";

  const subY = 960; // Vertical center (1080p height)

  for (const timing of timings) {
    const startTime = formatASSTime(timing.start);
    const endTime = formatASSTime(timing.end);
    const wordDurationMs = Math.round((timing.end - timing.start) * 1000);

    // Check if keyword
    const isKeyword = keywords.some((k) => k.word === timing.word);
    const styleName = isKeyword ? "Keyword" : "Default";

    // Bouncing animation sequence:
    //  Phase 1 (0 → 80ms):  scale 0 → 120  (pop in)
    //  Phase 2 (80 → 200ms): scale 120 → 100 (settle)
    //  Phase 3 (wordDuration-100 → wordDuration): scale 100 → 0 (fade out)
    const fadeInEnd = Math.min(80, wordDurationMs / 3);
    const settleEnd = Math.min(200, (wordDurationMs * 2) / 3);
    const fadeOutStart = Math.max(wordDurationMs - 100, (wordDurationMs * 2) / 3);

    const effect = isKeyword
      ? `{\\pos(540,${subY})\\an5\\fscx0\\fscy0\\t(${fadeInEnd},${settleEnd},\\fscx130\\fscy130)\\t(${settleEnd},${fadeOutStart},\\fscx100\\fscy100)\\t(${fadeOutStart},${wordDurationMs},\\fscx0\\fscy0)}`
      : `{\\pos(540,${subY})\\an5\\fscx0\\fscy0\\t(${fadeInEnd},${settleEnd},\\fscx120\\fscy120)\\t(${settleEnd},${fadeOutStart},\\fscx100\\fscy100)\\t(${fadeOutStart},${wordDurationMs},\\fscx0\\fscy0)}`;

    ass += `Dialogue: 0,${startTime},${endTime},${styleName},,0,0,0,,${effect}${timing.word}\n`;
  }

  return ass;
}

// ─── Animated Gradient Background (Retention Booster #3) ───────────────────

/**
 * Generate an animated radial gradient filter that shifts color over time.
 *
 * Uses geq filter with time-based RGB modulation:
 *   - Center pulses brighter
 *   - Edge color shifts slightly with sin/cos waves
 *   - Creates "breathing" tech atmosphere
 *
 * @param width     Frame width
 * @param height    Frame height
 * @param colorFrom Dark base color (hex)
 * @param colorTo   Accent color (hex)
 * @param duration  Video duration for cycle calculation
 */
export function generateAnimatedGradientFilter(
  width: number,
  height: number,
  colorFrom: string = "#0d0d0d",
  colorTo: string = "#2c0000",
  duration: number = 10
): string {
  const fromRGB = hexToRGB(colorFrom);
  const toRGB = hexToRGB(colorTo);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  // Time-based animation parameters
  const cycleSlow = duration; // full cycle over video duration
  const pulseAmp = 0.08;      // 8% brightness pulse

  // Radial distance function
  const distExpr = `sqrt((W-${cx})*(W-${cx})+(H-${cy})*(H-${cy}))`;

  // Animated gradient: base + pulse + edge shift
  // geq uses 'T' (uppercase) for time variable
  const rExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.r}-${fromRGB.r})+${fromRGB.r}+${pulseAmp}*${fromRGB.r}*sin(T*2*PI/${cycleSlow})`;

  const gExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.g}-${fromRGB.g})+${fromRGB.g}+${pulseAmp}*${fromRGB.g}*cos(T*2*PI/${cycleSlow}*1.3)`;

  const bExpr = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.b}-${fromRGB.b})+${fromRGB.b}+${pulseAmp}*${fromRGB.b}*sin(T*2*PI/${cycleSlow}*0.7)`;

  return `geq=r='${rExpr}':g='${gExpr}':b='${bExpr}'`;
}

/**
 * Generate static radial gradient (original, non-animated version).
 */
export function generateGradientFilter(
  width: number,
  height: number,
  colorFrom: string = "#0d0d0d",
  colorTo: string = "#2c0000"
): string {
  const fromRGB = hexToRGB(colorFrom);
  const toRGB = hexToRGB(colorTo);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const distExpr = `sqrt((W-${cx})*(W-${cx})+(H-${cy})*(H-${cy}))`;
  const r = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.r}-${fromRGB.r})+${fromRGB.r}`;
  const g = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.g}-${fromRGB.g})+${fromRGB.g}`;
  const b = `(1-exp(-(${distExpr}/${maxDist})*3))*(${toRGB.b}-${fromRGB.b})+${fromRGB.b}`;

  return `geq=r=${r}:g=${g}:b=${b}`;
}

// ─── Terminal Box ─────────────────────────────────────────────────────────────

/**
 * Create terminal-style code window box overlay.
 */
export function generateTerminalBox(
  _width: number,
  _height: number,
  _x: number,
  _y: number,
  visualId: string
): string {
  // Box is drawn inline in video-renderer; this returns a placeholder
  const boxColor = visualId === "terminal" ? "0x00FF00" : "0x00FFFF";
  return `drawbox=color=${boxColor}:width=2:radius=8:t=fill`;
}

// ─── Neon Glow Effect ────────────────────────────────────────────────────────

/**
 * Generate ASS override tag for neon glow on text.
 */
export function generateNeonGlowEffect(text: string, color: string = "#FFFF00"): string {
  const rgb = hexToRGB(color);
  return `{\\blur5\\c&H${rgb.b.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.r.toString(16).padStart(2, "0")}&}${text}{\\r}`;
}

// ─── Typing Animation ────────────────────────────────────────────────────────

/**
 * Generate dialogue events for character-by-character typing effect.
 */
export function generateTypingEffect(text: string, startTime: number, endTime: number): string {
  const duration = endTime - startTime;
  const charDuration = duration / text.length;

  let effect = "";
  for (let i = 0; i < text.length; i++) {
    const charStart = formatASSTime(startTime + i * charDuration);
    const charEnd = formatASSTime(startTime + (i + 1) * charDuration);
    effect += `Dialogue: 0,${charStart},${charEnd},Default,,0,0,0,,${text[i]}\n`;
  }

  return effect;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

/**
 * Generate ASS events for a left-to-right progress bar animation.
 */
export function generateProgressBarASS(
  x: number,
  y: number,
  width: number,
  height: number,
  duration: number
): string {
  const steps = Math.floor(duration * 10); // 10 FPS
  const stepWidth = width / steps;

  let events = "";
  for (let i = 0; i <= steps; i++) {
    const time = formatASSTime(i / 10);
    const currentWidth = Math.round(stepWidth * i);
    events += `Dialogue: 0,${time},${time + 0.2},Default,,0,0,0,,{\\pos(${x},${y})\\clip(${x},${y},${x + currentWidth},${y + height})}\\h\n`;
  }

  return events;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Format seconds to ASS timestamp (H:MM:SS.cc).
 */
export function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.round((seconds % 1) * 100);

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

/**
 * Convert hex color string to RGB object.
 */
function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Save ASS content to a file.
 */
export async function saveASSFile(content: string, outputPath: string): Promise<void> {
  const fs = await import("fs");
  fs.writeFileSync(outputPath, content, "utf-8");
}
