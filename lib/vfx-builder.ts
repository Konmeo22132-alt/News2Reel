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
 *   - VSScreen:    dual drawbox comparison layout
 *   - Checklist:   staggered enable='gte(t,X)' per item
 *   - Demo:        emoji icon + title (normal scene, handled by main renderer)
 *
 * All coordinates assume 1080×1920 (9:16 TikTok format).
 * Frame time `t` is scene-local (each scene is a separate FFmpeg call starting at t=0).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1920;

/** System font for drawtext. Falls back gracefully on both Linux and Windows. */
const FONT_BOLD =
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

/** Monospace font for terminal scenes */
const FONT_MONO =
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";

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
 * FFmpeg drawtext requires escaping: \ : , ' [ ]
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\u2019")        // curly quote — avoids shell escaping issues
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/** Chain two filter segments with a labeled intermediate output */
function chain(segment: string, label: string): string {
  return segment + `[${label}]; [${label}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Counter Scene (Odometer Effect)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Giant glowing number that counts up from 0 → counter_end over the scene duration.
 *
 * FFmpeg formula (scene-local t starts at 0):
 *   value = min(max(t, 0) / RAMP_DUR, 1) * END_VAL
 *
 * We ramp over 80% of the scene duration so the number lands before audio ends.
 */
export function buildCounterFilter(
  scene: CounterSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H, duration = 5 } = opts;
  const END = scene.counter_end;
  const RAMP = (duration * 0.8).toFixed(3); // ramp over 80% of scene
  const prefix = scene.counter_prefix ?? "";
  const suffix = scene.counter_suffix ?? "";
  const label = scene.counter_label ?? "";

  const cy = Math.floor(height / 2);
  const numY = cy - 130;
  const lblY = cy + 80;

  // The expression computes int(min(t/RAMP, 1) * END)
  const countExpr = `%{expr_int_format\\:min(max(t\\,0)/${RAMP}\\,1)*${END}\\:d\\:0}`;
  const displayText = `${esc(prefix)}${countExpr}${esc(suffix)}`;

  let f = `[${inputLabel}]`;

  // Giant red counter number
  f += `drawtext=text='${displayText}'`;
  f += `:x=(w-tw)/2:y=${numY}`;
  f += `:fontsize=210:fontcolor=0xFF3333@1`;
  f += `:fontfile='${FONT_BOLD}'`;
  f = chain(f, "cnt_n");

  // Label below number
  if (label) {
    f += `drawtext=text='${esc(label)}'`;
    f += `:x=(w-tw)/2:y=${lblY}`;
    f += `:fontsize=54:fontcolor=0xFFFFFF@0.88`;
    f += `:fontfile='${FONT_BOLD}'`;
    f = chain(f, "cnt_l");
  }

  // chain() appends "[cnt_X]; [cnt_X]" — we must replace the WHOLE pair (not just "; [cnt_X]")
  // to avoid leaving a dangling "[cnt_X]" before the output label.
  f = f.replace(/\[cnt_[nl]\]; \[cnt_[nl]\]$/, `[${outputLabel}]`);

  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Progress Bar Scene
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Horizontal bar that fills from 0 → target% using a dynamic drawbox width.
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

  const BAR_H = 58;
  const BAR_X = 60;
  const BAR_W = width - 120;
  const BAR_Y = Math.floor(height / 2) + 30;
  const LABEL_Y = BAR_Y - 80;
  const PCT_Y = BAR_Y + BAR_H + 24;

  const targetFrac = (target / 100).toFixed(4);
  const fillWExpr = `min(max(t\\,0)/${RAMP}\\,1)*${targetFrac}*${BAR_W}`;
  const pctExpr = `%{expr_int_format\\:min(max(t\\,0)/${RAMP}\\,1)*${target}\\:d\\:0}%`;

  let f = `[${inputLabel}]`;

  // Background track
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w=${BAR_W}:h=${BAR_H}:color=0x333333@1:t=fill`;
  f = chain(f, "pb_bg");

  // Animated fill
  f += `drawbox=x=${BAR_X}:y=${BAR_Y}:w='${fillWExpr}':h=${BAR_H}:color=0xFF3333@1:t=fill`;
  f = chain(f, "pb_bar");

  // Optional label
  if (label) {
    f += `drawtext=text='${esc(label)}':x=(w-tw)/2:y=${LABEL_Y}:fontsize=52:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}'`;
    f = chain(f, "pb_lbl");
  }

  // Percentage counter
  f += `drawtext=text='${pctExpr}':x=(w-tw)/2:y=${PCT_Y}:fontsize=76:fontcolor=0xFF5555:fontfile='${FONT_BOLD}'`;

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Terminal Scene (Typewriter CLI)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * macOS-style terminal window with character-by-character typewriter.
 *
 * Per spec: Loop over each character and emit a drawtext with
 * `enable='gte(t, charIndex * 0.05)'` so characters appear one by one.
 *
 * Approximate char width for monospace fontsize=32 ≈ 18px per char.
 */
export function buildTerminalFilter(
  scene: TerminalSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const { terminal_lines: lines, terminal_title = "" } = scene;

  const PANEL_W = width - 80;
  const LINE_H = 52;
  const BAR_H = 46;
  const PANEL_H = Math.min(BAR_H + 20 + lines.length * LINE_H + 20, 480);
  const PANEL_X = 40;
  const PANEL_Y = Math.floor(height / 2) - Math.floor(PANEL_H / 2);
  const CHAR_W = 18; // approximate for fontsize=32 monospace
  const CHAR_DELAY = 0.05; // seconds per character

  let f = `[${inputLabel}]`;
  let nodeIdx = 0;

  const mid = (from: string, to: string) => {
    f += `[w${nodeIdx}]; [w${nodeIdx}]`;
    nodeIdx++;
  };

  // ── Window background ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${PANEL_H}:color=0x1A1A1AEE:t=fill`;
  f = chain(f, `t${nodeIdx++}`);

  // ── Title bar ──
  f += `drawbox=x=${PANEL_X}:y=${PANEL_Y}:w=${PANEL_W}:h=${BAR_H}:color=0x2D2D2DEE:t=fill`;
  f = chain(f, `t${nodeIdx++}`);

  // ── Traffic light dots ──
  const DOT_Y = PANEL_Y + Math.floor((BAR_H - 20) / 2);
  const DOTS = [
    { x: PANEL_X + 16, color: "0xFF5F56" },
    { x: PANEL_X + 44, color: "0xFFBD2E" },
    { x: PANEL_X + 72, color: "0x28CA41" },
  ];
  for (const dot of DOTS) {
    f += `drawbox=x=${dot.x}:y=${DOT_Y}:w=20:h=20:color=${dot.color}:t=fill`;
    f = chain(f, `t${nodeIdx++}`);
  }

  // ── Optional title in bar ──
  if (terminal_title) {
    f += `drawtext=text='${esc(terminal_title.slice(0, 40))}':x=${PANEL_X + 108}:y=${PANEL_Y + 11}:fontsize=26:fontcolor=0xCCCCCC:fontfile='${FONT_BOLD}'`;
    f = chain(f, `t${nodeIdx++}`);
  }

  // ── Typewriter lines (char by char) ──
  const LINE_START_Y = PANEL_Y + BAR_H + 14;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineStr = lines[lineIdx].slice(0, 60); // cap at 60 chars
    const lineDelay = lineIdx * (lineStr.length + 2) * CHAR_DELAY; // previous lines' time
    const isCommand = lineStr.startsWith(">");
    const charColor = isCommand ? "0x00FF88" : "0xCCCCCC";
    const lineY = LINE_START_Y + lineIdx * LINE_H;

    for (let charIdx = 0; charIdx < lineStr.length; charIdx++) {
      const char = lineStr[charIdx];
      const charX = PANEL_X + 16 + charIdx * CHAR_W;
      const appearTime = (lineDelay + charIdx * CHAR_DELAY).toFixed(3);

      f += `drawtext=text='${esc(char)}':x=${charX}:y=${lineY}`;
      f += `:fontsize=32:fontcolor=${charColor}`;
      f += `:fontfile='${FONT_MONO}'`;
      f += `:enable='gte(t,${appearTime})'`;

      const isLast = lineIdx === lines.length - 1 && charIdx === lineStr.length - 1;
      if (!isLast) {
        f = chain(f, `t${nodeIdx++}`);
      }
    }
  }

  // Edge case: no lines → just close the window box
  if (lines.length === 0) {
    f = chain(f, `t${nodeIdx++}`);
    f += `drawtext=text='':x=0:y=0`;
  }

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// D. VS Screen Scene (Side-by-side Comparison)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Two colored boxes with text, separated by a "VS" badge.
 * Colors support AARRGGBB hex (opacity in color = 0x8B0000@0.85 syntax).
 */
export function buildVSScreenFilter(
  scene: VSScreenSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, width = W, height = H } = opts;
  const leftColor = (scene.vs_left_color ?? "#6B0000").replace("#", "0x");
  const rightColor = (scene.vs_right_color ?? "#003B1E").replace("#", "0x");

  const GAP = 24;
  const BOX_W = Math.floor((width - GAP * 3) / 2);
  const BOX_H = 140;
  const BOX_Y = Math.floor(height / 2) - Math.floor(BOX_H / 2);
  const LEFT_X = GAP;
  const RIGHT_X = GAP * 2 + BOX_W;
  const VS_X = GAP + BOX_W + Math.floor(GAP / 2) - 22;
  const TEXT_Y = BOX_Y + Math.floor(BOX_H / 2) - 26;

  let nodeIdx = 0;
  let f = `[${inputLabel}]`;

  // Left box
  f += `drawbox=x=${LEFT_X}:y=${BOX_Y}:w=${BOX_W}:h=${BOX_H}:color=${leftColor}@0.88:t=fill`;
  f = chain(f, `vs${nodeIdx++}`);

  // Right box
  f += `drawbox=x=${RIGHT_X}:y=${BOX_Y}:w=${BOX_W}:h=${BOX_H}:color=${rightColor}@0.88:t=fill`;
  f = chain(f, `vs${nodeIdx++}`);

  // Left text (red accent)
  f += `drawtext=text='${esc(scene.vs_left)}':x=${LEFT_X + 20}:y=${TEXT_Y}:fontsize=46:fontcolor=0xFF6666:fontfile='${FONT_BOLD}'`;
  f = chain(f, `vs${nodeIdx++}`);

  // Right text (green accent)
  f += `drawtext=text='${esc(scene.vs_right)}':x=${RIGHT_X + 20}:y=${TEXT_Y}:fontsize=46:fontcolor=0x66FF99:fontfile='${FONT_BOLD}'`;
  f = chain(f, `vs${nodeIdx++}`);

  // VS badge (white)
  f += `drawtext=text='VS':x=${VS_X}:y=${TEXT_Y + 4}:fontsize=52:fontcolor=0xFFFFFF@0.95:fontfile='${FONT_BOLD}'`;

  f += `[${outputLabel}]`;
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// E. Checklist Scene
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Items appear one by one using enable='gte(t, APPEAR_TIME)'.
 * Each item staggered by 0.7s. ✓ checkmark in green, text in white.
 */
export function buildChecklistFilter(
  scene: ChecklistSceneData,
  opts: BuilderOpts
): string {
  const { inputLabel, outputLabel, height = H } = opts;
  const { checklist_items: items } = scene;

  if (!items?.length) {
    return `[${inputLabel}]null[${outputLabel}]`;
  }

  const STAGGER = 0.7;
  const LINE_H = 84;
  const START_Y = Math.floor(height / 2) - Math.floor((items.length * LINE_H) / 2);
  const CHECK_X = 64;
  const TEXT_X = 148;

  let nodeIdx = 0;
  let f = `[${inputLabel}]`;

  for (let i = 0; i < items.length; i++) {
    const y = START_Y + i * LINE_H;
    const appear = (i * STAGGER).toFixed(2);
    const text = esc(items[i].slice(0, 42));
    const isLast = i === items.length - 1;

    // ✓ checkmark
    f += `drawtext=text='✓':x=${CHECK_X}:y=${y}:fontsize=60:fontcolor=0x00FF88:fontfile='${FONT_BOLD}':enable='gte(t,${appear})'`;
    f = chain(f, `cl${nodeIdx++}`);

    // Item text
    f += `drawtext=text='${text}':x=${TEXT_X}:y=${y + 4}:fontsize=54:fontcolor=0xFFFFFF:fontfile='${FONT_BOLD}':enable='gte(t,${appear})'`;

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
 * Returns null if no special filter is needed (scene_type === "normal" / "demo").
 *
 * Caller is responsible for connecting [specialOut] → ass filter → [out].
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

  return null; // "normal" / "demo" scenes — handled by caller
}
