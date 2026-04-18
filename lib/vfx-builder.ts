/**
 * VFX Builder — FFmpeg filter string generators for each SceneType.
 *
 * Architecture: Pure functions that accept scene data + I/O labels
 * and return an FFmpeg filter_complex string segment.
 *
 * Spec: "Senior Video Processing Engineer" spec v1.0
 *   - Counter:     min(max(t-ST,0)/DUR,1)*END_VAL odometer
 *   - ProgressBar: dynamic drawbox width expression
 *   - Terminal:    character-by-character typewriter (0.05s per char)
 *   - VSScreen:    dual half-screen comparison layout
 *   - Checklist:   staggered enable='gte(t,X)' per item
 *
 * All coordinates assume 1080×1920 (9:16 TikTok format).
 * Frame time `t` is scene-local (each scene is a separate FFmpeg call starting at t=0).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;

/**
 * Primary font — DejaVu Sans Bold.
 * Guaranteed on Ubuntu/Debian. Covers Latin + Vietnamese diacritics (partial).
 * For full Vietnamese support, install fonts-noto: apt-get install fonts-noto-core
 */
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/**
 * Fallback fonts tried in order for Vietnamese coverage.
 * Terminal uses FONT_BOLD (NOT mono) because DejaVuSansMono lacks Vietnamese glyphs.
 */
const FONT_SANS = FONT_BOLD;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuilderOpts {
  inputLabel: string;
  outputLabel: string;
  width?: number;
  height?: number;
  duration?: number; // scene duration in seconds (for animations)
}

export interface CounterSceneData {
  scene_type: "counter";
  counter_end: number;
  counter_label?: string;
  counter_suffix?: string;
  counter_prefix?: string;
}

export interface VSScreenSceneData {
  scene_type: "vs_screen";
  vs_left: string;
  vs_right: string;
  vs_left_color?: string;
  vs_right_color?: string;
}

export interface TerminalSceneData {
  scene_type: "terminal";
  terminal_lines: string[];
  terminal_title?: string;
}

export interface ChecklistSceneData {
  scene_type: "checklist";
  checklist_items: string[];
}

export interface ProgressBarSceneData {
  scene_type: "progress_bar";
  progress_target: number;
  progress_label?: string;
}

export type SpecialSceneData =
  | CounterSceneData
  | VSScreenSceneData
  | TerminalSceneData
  | ChecklistSceneData
  | ProgressBarSceneData;

// ─── Escape Helpers ───────────────────────────────────────────────────────────

/**
 * Escape text for FFmpeg drawtext filter.
 * FFmpeg drawtext requires: \ : , ' [ ] must be escaped.
 * Replace straight apostrophe with curly quote to avoid shell issues.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")        // curly quote — avoids shell escaping
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/** Wrap a filter segment with an intermediate label for chaining */
function chain(segment: string, label: string): string {
  return segment + `[${label}]; [${label}]`;
}

/** Shared glow/shadow options for drawtext */
const GLOW = `:shadowcolor=0x000000@0.9:shadowx=3:shadowy=3`;

// ─────────────────────────────────────────────────────────────────────────────
// A. Counter Scene (Odometer Effect)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Giant glowing number that counts up from 0 → counter_end over the scene.
 *
 * Layout (1080×1920):
 *   - Number: center-X, Y ~= height*0.35 (upper third — clear of subtitle zone)
 *   - Label:  center-X, Y ~= number_Y + 260
 *
 * FFmpeg formula (scene-local t starts at 0):
 *   value = min(max(t, 0) / RAMP_DUR, 1) * END_VAL
 */
export function buildCounterFilter(
  scene: CounterSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H, duration = 5 } = opts;
  const END = scene.counter_end;
  const RAMP = (duration * 0.8).toFixed(3);
  const prefix = scene.counter_prefix ?? "";
  const suffix = scene.counter_suffix ?? "";
  const label = scene.counter_label ?? "";

  // Position in upper-center of screen — well clear of subtitle zone at bottom
  const numY = Math.floor(height * 0.3);
  const lblY = numY + 240;

  const countExpr = `%{expr_int_format\\:min(max(t\\,0)/${RAMP}\\,1)*${END}\\:d\\:0}`;
  const displayText = `${esc(prefix)}${countExpr}${esc(suffix)}`;

  let f = `[${inputLabel}]`;

  // Giant red counter with glow
  f += `drawtext=text='${displayText}'`;
  f += `:x=(w-tw)/2:y=${numY}`;
  f += `:fontsize=240:fontcolor=0xFF3333@1`;
  f += `:fontfile='${FONT_BOLD}'`;
  f += GLOW;

  if (label) {
    f = chain(f, "cnt_n");
    f += `drawtext=text='${esc(label)}'`;
    f += `:x=(w-tw)/2:y=${lblY}`;
    f += `:fontsize=58:fontcolor=0xFFFFFF@0.95`;
    f += `:fontfile='${FONT_BOLD}'`;
    f += GLOW;
    f += `[${outputLabel}]`;
  } else {
    f += `[${outputLabel}]`;
  }

  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Progress Bar Scene
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Horizontal bar filling from 0 → target% using dynamic drawbox width.
 *
 * FFmpeg formula:
 *   w = 'min(max(t,0)/RAMP, 1) * MAX_BAR_WIDTH'
 */
export function buildProgressBarFilter(
  scene: ProgressBarSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H, duration = 5 } = opts;
  const target = Math.min(Math.max(scene.progress_target, 0), 100);
  const label = scene.progress_label ?? "";
  const RAMP = (duration * 0.75).toFixed(3);

  const BAR_H = 64;
  const BAR_X = 60;
  const BAR_W = width - 120;
  const BAR_Y = Math.floor(height * 0.45);
  const LABEL_Y = BAR_Y - 90;
  const PCT_Y = BAR_Y + BAR_H + 28;

  const targetFrac = (target / 100).toFixed(4);
  const fillWExpr = `min(max(t\\,0)/${RAMP}\\,1)*${targetFrac}*${BAR_W}`;
  const pctExpr = `%{expr_int_format\\:min(max(t\\,0)/${RAMP}\\,1)*${target}\\:d\\:0}%`;

  let f = `[${inputLabel}]`;

  // Dark background track
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w=${BAR_W}:h=${BAR_H}:color=0x222222@1:t=fill`;
  f = chain(f, "pb_bg");

  // Animated fill bar
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w='${fillWExpr}':h=${BAR_H}:color=0xFF3333@1:t=fill`;
  f = chain(f, "pb_bar");

  // Optional label
  if (label) {
    f += `drawtext=text='${esc(label)}':x=(w-tw)/2:y=${LABEL_Y}:fontsize=56:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}'${GLOW}`;
    f = chain(f, "pb_lbl");
  }

  // Percentage counter
  f += `drawtext=text='${pctExpr}':x=(w-tw)/2:y=${PCT_Y}:fontsize=80:fontcolor=0xFF5555:fontfile='${FONT_BOLD}'${GLOW}`;
  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Terminal Scene (Typewriter CLI)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * macOS-style terminal window with character-by-character typewriter.
 *
 * FONT NOTE: Uses FONT_BOLD (not mono) because DejaVuSansMono lacks Vietnamese
 * character support. FONT_BOLD still looks code-like in a dark window.
 *
 * Each character appears at `charIndex * 0.05s`.
 */
export function buildTerminalFilter(
  scene: TerminalSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const { terminal_lines: lines, terminal_title = "" } = scene;

  const PANEL_W = width - 60;
  const LINE_H = 58;
  const BAR_H = 50;
  const PANEL_H = Math.min(BAR_H + 24 + lines.length * LINE_H + 24, 520);
  const PANEL_X = 30;
  // Center vertically in upper 60% of screen (keep below from subtitle zone)
  const PANEL_Y = Math.floor(height * 0.25) - Math.floor(PANEL_H / 2);
  const CHAR_W = 17;
  const CHAR_DELAY = 0.05;

  let f = `[${inputLabel}]`;
  let nodeIdx = 0;

  // ── Window shadow (slightly larger, dark) ──
  f += `drawbox=x=${PANEL_X - 6}:y=${PANEL_Y - 6}:w=${PANEL_W + 12}:h=${PANEL_H + 12}:color=0x000000@0.7:t=fill`;
  f = chain(f, `t${nodeIdx++}`);

  // ── Window background ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=0x1C1C1C@1:t=fill`;
  f = chain(f, `t${nodeIdx++}`);

  // ── Title bar (slightly lighter) ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${BAR_H}:color=0x323232@1:t=fill`;
  f = chain(f, `t${nodeIdx++}`);

  // ── Traffic light dots ──
  const DOT_Y = PANEL_Y + Math.floor((BAR_H - 22) / 2);
  const DOTS = [
    { x: PANEL_X + 18, color: "0xFF5F56" },
    { x: PANEL_X + 48, color: "0xFFBD2E" },
    { x: PANEL_X + 78, color: "0x28CA41" },
  ];
  for (const dot of DOTS) {
    f += `drawbox=x=${dot.x}:y=${DOT_Y}:w=22:h=22:color=${dot.color}:t=fill`;
    f = chain(f, `t${nodeIdx++}`);
  }

  // ── Optional title in bar ──
  if (terminal_title) {
    f += `drawtext=text='${esc(terminal_title.slice(0, 45))}':x=${PANEL_X + 120}:y=${PANEL_Y + 13}:fontsize=28:fontcolor=0xAAAAAA:fontfile='${FONT_BOLD}'`;
    f = chain(f, `t${nodeIdx++}`);
  }

  // ── Typewriter: char-by-char for each line ──
  const LINE_START_Y = PANEL_Y + BAR_H + 16;

  if (lines.length === 0) {
    // Edge case: no lines
    f += `drawtext=text='':x=0:y=0[${outputLabel}]`;
    return f;
  }

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineStr = lines[lineIdx].slice(0, 55);
    const lineDelay = lineIdx * (lineStr.length + 3) * CHAR_DELAY;
    const isCommand = lineStr.startsWith(">");
    const charColor = isCommand ? "0x00FF88" : "0xCCCCCC";
    const lineY = LINE_START_Y + lineIdx * LINE_H;

    for (let charIdx = 0; charIdx < lineStr.length; charIdx++) {
      const char = lineStr[charIdx];
      const charX = PANEL_X + 18 + charIdx * CHAR_W;
      const appearTime = (lineDelay + charIdx * CHAR_DELAY).toFixed(3);

      f += `drawtext=text='${esc(char)}':x=${charX}:y=${lineY}`;
      f += `:fontsize=34:fontcolor=${charColor}`;
      f += `:fontfile='${FONT_SANS}'`;     // FONT_SANS = FONT_BOLD for Vietnamese support
      f += `:enable='gte(t,${appearTime})'`;

      const isLast = lineIdx === lines.length - 1 && charIdx === lineStr.length - 1;
      if (!isLast) {
        f = chain(f, `t${nodeIdx++}`);
      }
    }
  }

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// D. VS Screen Scene (Side-by-side Comparison)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Two equal vertical panels with text and a "VS" badge in the center gap.
 *
 * Layout fix: each panel is half the screen width minus padding.
 * Text is centered inside its panel, not overlapping the gap.
 * "VS" badge sits exactly in the center of the screen.
 */
export function buildVSScreenFilter(
  scene: VSScreenSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const leftColor = (scene.vs_left_color ?? "#6B0000").replace("#", "0x");
  const rightColor = (scene.vs_right_color ?? "#003B1E").replace("#", "0x");

  const GAP = 8;              // gap between the two panels
  const PANEL_W = Math.floor((width - GAP) / 2);
  const PANEL_H = Math.floor(height * 0.22); // 22% of screen height
  const PANEL_Y = Math.floor(height / 2) - Math.floor(PANEL_H / 2);

  const LEFT_X = 0;
  const RIGHT_X = PANEL_W + GAP;
  const CENTER_X = Math.floor(width / 2);

  // Text is centered INSIDE each panel (not near the edge where VS badge sits)
  // Use x=(LEFT_X + PANEL_W/2 - text_center) → approximate with left offset
  const LEFT_TEXT_X = LEFT_X + 24;
  const RIGHT_TEXT_X = RIGHT_X + 24;
  const TEXT_Y = PANEL_Y + Math.floor(PANEL_H * 0.35);

  // VS badge
  const VS_BADGE_X = CENTER_X - 36;
  const VS_BADGE_Y = PANEL_Y + Math.floor(PANEL_H / 2) - 36;

  let nodeIdx = 0;
  let f = `[${inputLabel}]`;

  // Left panel
  f += `drawbox=x=${LEFT_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=${leftColor}@0.92:t=fill`;
  f = chain(f, `vs${nodeIdx++}`);

  // Right panel
  f += `drawbox=x=${RIGHT_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=${rightColor}@0.92:t=fill`;
  f = chain(f, `vs${nodeIdx++}`);

  // Left label (truncate to 12 chars to fit panel)
  const leftStr = esc(scene.vs_left.slice(0, 12));
  f += `drawtext=text='${leftStr}':x=${LEFT_TEXT_X}:y=${TEXT_Y}:fontsize=52:fontcolor=0xFF8888:fontfile='${FONT_BOLD}'${GLOW}`;
  f = chain(f, `vs${nodeIdx++}`);

  // Right label (truncate to 12 chars to fit panel)
  const rightStr = esc(scene.vs_right.slice(0, 12));
  f += `drawtext=text='${rightStr}':x=${RIGHT_TEXT_X}:y=${TEXT_Y}:fontsize=52:fontcolor=0x88FF99:fontfile='${FONT_BOLD}'${GLOW}`;
  f = chain(f, `vs${nodeIdx++}`);

  // "VS" badge circle (dark background)
  f += `drawbox=x=${CENTER_X - 44}:y=${VS_BADGE_Y - 10}:w=88:h=88:color=0x111111@0.95:t=fill`;
  f = chain(f, `vs${nodeIdx++}`);

  // "VS" text
  f += `drawtext=text='VS':x=${VS_BADGE_X}:y=${VS_BADGE_Y}:fontsize=56:fontcolor=0xFFFF00@0.98:fontfile='${FONT_BOLD}'${GLOW}`;
  f += `[${outputLabel}]`;

  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Checklist Scene
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Items appear one by one using enable='gte(t, APPEAR_TIME)'.
 * Stagger = 0.7s. ✓ checkmark in green, text in white with glow.
 * Positioned in the upper-center zone (clear of subtitle at bottom).
 */
export function buildChecklistFilter(
  scene: ChecklistSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, height = H } = opts;
  const { checklist_items: items } = scene;

  if (!items?.length) {
    return `[${inputLabel}]drawtext=text='':x=0:y=0[${outputLabel}]`;
  }

  const STAGGER = 0.7;
  const LINE_H = 90;
  // Position in upper 40% of screen
  const startY = Math.floor(height * 0.2);
  const CHECK_X = 64;
  const TEXT_X = 160;

  let nodeIdx = 0;
  let f = `[${inputLabel}]`;

  for (let i = 0; i < items.length; i++) {
    const y = startY + i * LINE_H;
    const appear = (i * STAGGER).toFixed(2);
    const text = esc(items[i].slice(0, 38));
    const isLast = i === items.length - 1;

    // ✓ checkmark
    f += `drawtext=text='✓':x=${CHECK_X}:y=${y}:fontsize=64:fontcolor=0x00FF88:fontfile='${FONT_BOLD}':enable='gte(t,${appear})'${GLOW}`;
    f = chain(f, `cl${nodeIdx++}`);

    // Item text
    f += `drawtext=text='${text}':x=${TEXT_X}:y=${y + 4}:fontsize=58:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}':enable='gte(t,${appear})'${GLOW}`;

    if (!isLast) {
      f = chain(f, `cl${nodeIdx++}`);
    }
  }

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router — buildSceneFilter
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Routes scene data to the correct filter builder.
 * Returns null for normal/demo scenes (handled by main renderer).
 *
 * Caller MUST:
 *   filterComplex += specialFilter + "; ";
 *   filterComplex += `[special_out]ass='...'[out]`;
 */
export function buildSceneFilter(
  sceneData: Record<string, unknown>,
  inputLabel: string,
  outputLabel: string,
  width: number,
  height: number,
  duration: number
): string | null {
  const opts: BuilderOpts = { inputLabel, outputLabel, width, height, duration };
  const type = sceneData.scene_type as string;

  switch (type) {
    case "counter":
      if (sceneData.counter_end != null) {
        return buildCounterFilter(sceneData as unknown as CounterSceneData, opts);
      }
      break;

    case "vs_screen":
      if (sceneData.vs_left) {
        return buildVSScreenFilter(sceneData as unknown as VSScreenSceneData, opts);
      }
      break;

    case "terminal":
      if (Array.isArray(sceneData.terminal_lines) && sceneData.terminal_lines.length > 0) {
        return buildTerminalFilter(sceneData as unknown as TerminalSceneData, opts);
      }
      break;

    case "checklist":
      if (Array.isArray(sceneData.checklist_items) && sceneData.checklist_items.length > 0) {
        return buildChecklistFilter(sceneData as unknown as ChecklistSceneData, opts);
      }
      break;

    case "progress_bar":
      if (sceneData.progress_target != null) {
        return buildProgressBarFilter(sceneData as unknown as ProgressBarSceneData, opts);
      }
      break;
  }

  return null; // normal/demo — handled by main renderer
}

/**
 * Returns true if a scene_type requires a full-screen special layout.
 * Used by video-renderer.ts to skip rendering the floating emoji icon
 * (which would overlap with the special scene elements).
 */
export function isSpecialSceneType(sceneType: string): boolean {
  return ["counter", "vs_screen", "terminal", "checklist", "progress_bar"].includes(sceneType);
}
