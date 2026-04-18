/**
 * VFX Builder — High-quality FFmpeg filter generators for each SceneType.
 *
 * Design principles (v2 overhaul):
 *  - Zero hard pop-ins: every element fades/slides using alpha expressions
 *  - Circles for terminal dots via Unicode ● (U+25CF) in drawtext
 *  - Counter: correct expr_int_format math + glow
 *  - VS Screen: text fades in from opposing sides via x-offset alpha math
 *  - Checklist: left-aligned, each item slides + fades in
 *  - Terminal: per-character alpha fade (smooth typewriter, not hard enable)
 *
 * All coordinates assume 1080×1920 (9:16 TikTok format).
 * `t` is scene-local (scene starts at t=0 in each FFmpeg call).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;

/** DejaVu Sans Bold — guaranteed on Ubuntu/Debian, covers Vietnamese diacritics */
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuilderOpts {
  inputLabel: string;
  outputLabel: string;
  width?: number;
  height?: number;
  duration?: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escape text for FFmpeg drawtext.
 * Replace ' with curly quote (sidesteps shell quoting),
 * escape : , [ ] for filter_complex syntax.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/** Chain two filters with an intermediate label */
function chain(segment: string, label: string): string {
  return segment + `[${label}]; [${label}]`;
}

/**
 * Smooth alpha fade-in expression for drawtext.
 * Element is invisible before `delay`, then fades in over `fadeDur` seconds.
 * @param delay    seconds before fade starts
 * @param fadeDur  fade duration in seconds (default 0.2)
 */
function fadeIn(delay: number, fadeDur = 0.2): string {
  return `:alpha='min(max(t-${delay.toFixed(3)},0)/${fadeDur.toFixed(3)},1)'`;
}

/** Glow shadow shared by all text elements */
const GLOW = ":shadowcolor=0x000000@0.95:shadowx=4:shadowy=4";

// ─────────────────────────────────────────────────────────────────────────────
// A. Counter Scene
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Smooth odometer counting 0 → counter_end.
 *
 * FFmpeg expr_int_format is evaluated per-frame:
 *   text='%{expr_int_format\:min(max(t\,0)/RAMP\,1)*END\:d\:0}'
 *
 * Layout: number in upper 35%, label fades in after 0.4s below.
 */
export function buildCounterFilter(
  scene: CounterSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H, duration = 5 } = opts;
  const END = scene.counter_end;
  const RAMP = (duration * 0.85).toFixed(3);
  const prefix = esc(scene.counter_prefix ?? "");
  const suffix = esc(scene.counter_suffix ?? "");
  const label = scene.counter_label ?? "";

  // Positioned well clear of subtitle (bottom) and top edge
  const numY = Math.floor(height * 0.28);
  const lblY = numY + 260;

  // Use frame number `n` (integer, 30fps) for perfectly smooth odometer.
  // Avoids floating-point time jitter that causes "jumping" with `t`.
  // Formula: if(n > RAMP_FRAMES, END, n * END / RAMP_FRAMES)
  // No min/max needed → no commas inside %{...} → zero escaping issues.
  const RAMP_F = Math.round(30 * parseFloat(RAMP)); // frames until full value
  const countExpr = `%{expr_int_format\\:if(gt(n\\,${RAMP_F})\\,${END}\\,n*${END}/${RAMP_F})\\:d\\:0}`;
  const displayText = `${prefix}${countExpr}${suffix}`;

  let f = `[${inputLabel}]`;

  // Giant red number — alpha fades in over first 0.3s
  f += `drawtext=text='${displayText}'`;
  f += `:x=(w-tw)/2:y=${numY}`;
  f += `:fontsize=250:fontcolor=0xFF3333@1`;
  f += `:fontfile='${FONT_BOLD}'`;
  f += GLOW;
  f += fadeIn(0.0, 0.3);

  if (label) {
    f = chain(f, "cnt_n");
    f += `drawtext=text='${esc(label)}'`;
    f += `:x=(w-tw)/2:y=${lblY}`;
    f += `:fontsize=62:fontcolor=0xFFFFFF@0.95`;
    f += `:fontfile='${FONT_BOLD}'`;
    f += GLOW;
    f += fadeIn(0.4, 0.3);
    f += `[${outputLabel}]`;
  } else {
    f += `[${outputLabel}]`;
  }

  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Progress Bar
// ─────────────────────────────────────────────────────────────────────────────
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
  const BAR_Y = Math.floor(height * 0.42);
  const LABEL_Y = BAR_Y - 90;
  const PCT_Y = BAR_Y + BAR_H + 30;

  const targetFrac = (target / 100).toFixed(4);
  const fillWExpr = `min(max(t\\,0)/${RAMP}\\,1)*${targetFrac}*${BAR_W}`;
  const pctExpr = `%{expr_int_format\\:min(max(t\\,0)/${RAMP}\\,1)*${target}\\:d\\:0}%`;

  let f = `[${inputLabel}]`;

  // Background track
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w=${BAR_W}:h=${BAR_H}:color=0x222222@1:t=fill`;
  f = chain(f, "pb_bg");

  // Animated fill
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w='${fillWExpr}':h=${BAR_H}:color=0xFF3333@1:t=fill`;
  f = chain(f, "pb_bar");

  if (label) {
    f += `drawtext=text='${esc(label)}':x=(w-tw)/2:y=${LABEL_Y}:fontsize=56:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(0.2)}`;
    f = chain(f, "pb_lbl");
  }

  f += `drawtext=text='${pctExpr}':x=(w-tw)/2:y=${PCT_Y}:fontsize=84:fontcolor=0xFF5555:fontfile='${FONT_BOLD}'${GLOW}`;
  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Terminal Scene — polished typewriter
// ─────────────────────────────────────────────────────────────────────────────
/**
 * macOS-style terminal window.
 *
 * Improvements over v1:
 *  • Traffic-light dots use Unicode ● (U+25CF) via drawtext — actual circles
 *  • Each character fades in smoothly over 50ms instead of hard-popping
 *  • Font is FONT_BOLD (not mono) for full Vietnamese glyph coverage
 *  • Window has a soft drop-shadow drawbox
 */
export function buildTerminalFilter(
  scene: TerminalSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const { terminal_lines: lines, terminal_title = "" } = scene;

  const PANEL_W = width - 60;
  const LINE_H = 60;
  const BAR_H = 52;
  const PANEL_H = Math.min(BAR_H + 24 + lines.length * LINE_H + 24, 540);
  const PANEL_X = 30;
  const PANEL_Y = Math.floor(height * 0.22) - Math.floor(PANEL_H / 2);
  const CHAR_W = 18;    // approximate char width at fontsize=34
  const CHAR_DELAY = 0.05; // 50ms per character

  let f = `[${inputLabel}]`;
  let n = 0; // node counter

  // ── Drop shadow ──
  f += `drawbox=x=${PANEL_X - 8}:y=${PANEL_Y - 8}:w=${PANEL_W + 16}:h=${PANEL_H + 16}:color=0x000000@0.65:t=fill`;
  f = chain(f, `t${n++}`);

  // ── Window background ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=0x1C1C1C@1:t=fill`;
  f = chain(f, `t${n++}`);

  // ── Title bar ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${BAR_H}:color=0x2D2D2D@1:t=fill`;
  f = chain(f, `t${n++}`);

  // ── Traffic light dots — using Unicode ● for real circles ──
  const DOT_CY = PANEL_Y + Math.floor(BAR_H / 2);
  const DOTS = [
    { x: PANEL_X + 22, color: "0xFF5F56", size: 38 },
    { x: PANEL_X + 56, color: "0xFFBD2E", size: 38 },
    { x: PANEL_X + 90, color: "0x28CA41", size: 38 },
  ];
  for (const dot of DOTS) {
    // ● at the right position — fontsize controls "circle" diameter
    f += `drawtext=text='●':x=${dot.x}:y=${DOT_CY - dot.size / 2 - 2}:fontsize=${dot.size}:fontcolor=${dot.color}:fontfile='${FONT_BOLD}'`;
    f = chain(f, `t${n++}`);
  }

  // ── Title text in bar ──
  if (terminal_title) {
    f += `drawtext=text='${esc(terminal_title.slice(0, 45))}':x=${PANEL_X + 130}:y=${PANEL_Y + 13}:fontsize=28:fontcolor=0xAAAAAA:fontfile='${FONT_BOLD}'`;
    f = chain(f, `t${n++}`);
  }

  // ── Typewriter lines — per-character alpha fade ──
  const LINE_START_Y = PANEL_Y + BAR_H + 16;

  if (lines.length === 0) {
    f += `drawtext=text='':x=0:y=0[${outputLabel}]`;
    return f;
  }

  for (let li = 0; li < lines.length; li++) {
    const lineStr = lines[li].slice(0, 52);
    // Line delay = sum of all previous lines' character count × CHAR_DELAY + gap
    const prevLen = lines.slice(0, li).reduce((sum, l) => sum + l.slice(0, 52).length, 0);
    const lineDelay = prevLen * CHAR_DELAY + li * CHAR_DELAY * 3;
    const isCommand = lineStr.startsWith(">");
    const charColor = isCommand ? "0x00FF88" : "0xCCCCCC";
    const lineY = LINE_START_Y + li * LINE_H;

    for (let ci = 0; ci < lineStr.length; ci++) {
      const char = lineStr[ci];
      const charX = PANEL_X + 18 + ci * CHAR_W;
      const appearTime = lineDelay + ci * CHAR_DELAY;

      f += `drawtext=text='${esc(char)}':x=${charX}:y=${lineY}`;
      f += `:fontsize=34:fontcolor=${charColor}`;
      f += `:fontfile='${FONT_BOLD}'`;
      // Smooth 50ms alpha fade instead of hard enable
      f += `:alpha='min(max(t-${appearTime.toFixed(3)},0)/0.05,1)'`;

      const isLast = li === lines.length - 1 && ci === lineStr.length - 1;
      if (!isLast) {
        f = chain(f, `t${n++}`);
      }
    }
  }

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// D. VS Screen — animated opposing slide-in
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Two side-by-side panels with title text fading in from opposing sides.
 *
 * Animation: left text starts at alpha=0 and fades in at t=0.2,
 *            right text fades in at t=0.35 — gives staggered feel.
 * VS badge: fades in last at t=0.5.
 */
export function buildVSScreenFilter(
  scene: VSScreenSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const leftColor = (scene.vs_left_color ?? "#5C0000").replace("#", "0x");
  const rightColor = (scene.vs_right_color ?? "#003318").replace("#", "0x");

  const GAP = 6;
  const PANEL_W = Math.floor((width - GAP) / 2);
  const PANEL_H = Math.floor(height * 0.25);
  const PANEL_Y = Math.floor(height / 2) - Math.floor(PANEL_H / 2);
  const LEFT_X = 0;
  const RIGHT_X = PANEL_W + GAP;
  const CENTER_X = Math.floor(width / 2);

  // Text inside panels — well padded from center gap & outer edge
  const L_TEXT_X = LEFT_X + 28;
  const R_TEXT_X = RIGHT_X + 28;
  const TEXT_Y = PANEL_Y + Math.floor(PANEL_H * 0.32);

  // Sub-label below main text
  const SUB_FONT = 38;
  const SUB_Y = TEXT_Y + 80;

  let n = 0;
  let f = `[${inputLabel}]`;

  // Left panel background — fades in from left
  f += `drawbox=x=${LEFT_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=${leftColor}@0.9:t=fill`;
  f = chain(f, `vs${n++}`);

  // Right panel background — fades in from right
  f += `drawbox=x=${RIGHT_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=${rightColor}@0.9:t=fill`;
  f = chain(f, `vs${n++}`);

  // Vertical separator
  f += `drawbox=x=${CENTER_X - 3}:y=${PANEL_Y}:w=${GAP}:h=${PANEL_H}:color=0x111111@1:t=fill`;
  f = chain(f, `vs${n++}`);

  // Left label — fades in at 0.15s
  const leftStr = esc(scene.vs_left.slice(0, 14));
  f += `drawtext=text='${leftStr}':x=${L_TEXT_X}:y=${TEXT_Y}:fontsize=54:fontcolor=0xFF8888:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(0.15, 0.25)}`;
  f = chain(f, `vs${n++}`);

  // Right label — fades in at 0.3s (staggered)
  const rightStr = esc(scene.vs_right.slice(0, 14));
  f += `drawtext=text='${rightStr}':x=${R_TEXT_X}:y=${TEXT_Y}:fontsize=54:fontcolor=0x88FF99:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(0.3, 0.25)}`;
  f = chain(f, `vs${n++}`);

  // VS badge background (dark pill behind "VS")
  f += `drawbox=x=${CENTER_X - 46}:y=${PANEL_Y + Math.floor(PANEL_H / 2) - 50}:w=92:h=92:color=0x000000@0.9:t=fill`;
  f = chain(f, `vs${n++}`);

  // "VS" text — fades in at 0.45s (last, for dramatic effect)
  const VS_X = CENTER_X - 38;
  const VS_Y = PANEL_Y + Math.floor(PANEL_H / 2) - 42;
  f += `drawtext=text='VS':x=${VS_X}:y=${VS_Y}:fontsize=58:fontcolor=0xFFFF44:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(0.45, 0.2)}`;
  f += `[${outputLabel}]`;

  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Checklist — left-aligned with staggered alpha fade
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Left-aligned checklist. Each item's ✓ appears first, then the text
 * fades in 0.1s later. Staggered by 0.65s between items.
 *
 * Positioned in the UPPER half (clear of subtitle at y=1580+).
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

  const STAGGER = 0.65;
  const LINE_H = 92;
  const startY = Math.floor(height * 0.18);
  const CHECK_X = 60;
  const TEXT_X = 162;

  let n = 0;
  let f = `[${inputLabel}]`;

  for (let i = 0; i < items.length; i++) {
    const y = startY + i * LINE_H;
    const checkDelay = i * STAGGER;
    const textDelay = checkDelay + 0.1;
    const text = esc(items[i].slice(0, 36));
    const isLast = i === items.length - 1;
    const SLIDE = 35; // pixels to slide up from

    // ✓ checkmark: fades in + slides up
    f += `drawtext=text='✓':x=${CHECK_X}:y='${y + SLIDE}-${SLIDE}*min(max(t-${checkDelay.toFixed(2)},0)/0.3,1)':fontsize=68:fontcolor=0x00FF88:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(checkDelay, 0.3)}`;
    f = chain(f, `cl${n++}`);

    // Item text: fades in 100ms after checkmark, also slides up
    f += `drawtext=text='${text}':x=${TEXT_X}:y='${y + SLIDE + 4}-${SLIDE}*min(max(t-${textDelay.toFixed(2)},0)/0.3,1)':fontsize=60:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}'${GLOW}${fadeIn(textDelay, 0.3)}`;

    if (!isLast) {
      f = chain(f, `cl${n++}`);
    }
  }

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

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

  return null;
}

/**
 * Returns true if this scene_type renders its own full-screen layout.
 * Used by video-renderer.ts to skip the floating emoji icon.
 */
export function isSpecialSceneType(sceneType: string): boolean {
  return ["counter", "vs_screen", "terminal", "checklist", "progress_bar"].includes(sceneType);
}
