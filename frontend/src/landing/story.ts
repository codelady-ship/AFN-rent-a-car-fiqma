/*
 * Scroll story for the AFN landing page: pure functions that turn scroll progress into scene values.
 * No React and no DOM here, so they are unit-tested in story.test.ts.
 *
 * Adapted from "Curated Recommendations Scroll Landing Page" (loupe-curator-landing.tsx)
 * by Kedhareswer Naidu, https://kedhar-components.pages.dev/#loupe-curator-landing
 * MIT License, Copyright (c) 2026 Kedhareswer Naidu — full text in frontend/src/landing/LICENSE-loupe.txt.
 * Changes: AFN scenes and timings, no golden-hour easter egg, typed helpers for the car scenes.
 */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Smootherstep: zero velocity at both ends, so beats hand over without a jolt. */
export const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const span = (p: number, w: readonly [number, number]) => clamp01((p - w[0]) / (w[1] - w[0]));
/** Frame-rate independent approach toward a target (tau in ms). Only visuals are eased; the page scroll is never touched. */
export const approach = (cur: number, target: number, dt: number, tau: number) => target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);

/** 0 → 1 while a stage is pinned (position: sticky) inside its track; clamps outside it. */
export const progressFrom = (top: number, height: number, stage: number) => {
  const travel = height - stage;
  if (!(travel > 0)) return 0;
  return clamp01((0 - top) / travel);
};

/** Track lengths, in stage heights. */
export const TRACK = { intro: 6, words: 3.4, zoom: 6, pile: 3.4 } as const;
/** The panel after a pinned stage slides over its last stage height of travel; the story is over by then. */
export const coverAt = (len: number) => 1 - 1 / (len - 1);

/** Beats of scene 1–3: fly through the photos, open the gap, grow into the studio, show the car's specs. */
export const INTRO = {
  fly: [0, 0.3],
  lineOut: [0.05, 0.15],
  open: [0.12, 0.22],
  flip: [0.12, 0.25],
  grow: [0.24, 0.46],
  caption: [0.36, 0.48],
  captionOut: [0.52, 0.57],
  callouts: [0.56, 0.68],
  strip: [0.6, 0.78],
} as const;
export const ZOOM = { open: [0.02, 0.08], grow: [0.08, 0.2], ui: [0.18, 0.26], drum: [0.26, 0.8] } as const;
export const PILE = { ink: [0, 0.26], drop: [0.06, 0.5], swap: [0.56, 0.68], type: [0.64, 0.8] } as const;
export const WORDS = { from: 0.9, to: -1.9, gap: 0.85 } as const;

/* ---- scene 1: the photo field, a fly-through that never runs out */
export const FIELD = { depth: 6, near: 0.45, travel: 3.8, idle: 0.07 } as const;
/** Screen position, scale and opacity of a photo at world (x, y, z) seen from camera depth cam. */
export function flyAt(x: number, y: number, z: number, cam: number, W: number, H: number) {
  const D = FIELD.depth;
  const d = (((z - cam) % D) + D) % D || D;
  const k = 1 / d;
  const o = clamp01((D - d) / 3) * clamp01((d - FIELD.near) / 0.55);
  return { x: W / 2 + x * (W / 2) * k, y: H / 2 + y * (H / 2) * k, s: k, o, d };
}
/** Seeded photo positions that keep clear of the headline in the middle. */
export function fieldLayout(n: number, seed: number) {
  const r = mulberry32(seed);
  const out: { x: number; y: number; z: number }[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const x = (r() * 2 - 1) * 1.25;
    const y = (r() * 2 - 1) * 1.15;
    if (Math.abs(x) < 0.42 && Math.abs(y) < 0.36) continue;
    out.push({ x, y, z: (out.length / n) * FIELD.depth + r() * 0.3 });
  }
  return out;
}

/* ---- scenes 2 and 6: a photo opens in the gap between two words, then grows to cover the stage */
export type Box = { x: number; y: number; w: number; h: number; r: number };
export function zoomBox(open: number, grow: number, W: number, H: number, w0: number, h0: number): Box {
  const o = smooth(open);
  const e = smooth(grow);
  const w = lerp(w0 * o, W, e);
  const h = lerp(h0 * (0.55 + 0.45 * o), H, e);
  return { x: (W - w) / 2, y: (H - h) / 2, w, h, r: lerp(8, 0, e) };
}
const px = (n: number) => Math.max(0, n).toFixed(1) + "px";
export const insetOf = (b: Box, W: number, H: number) =>
  "inset(" + px(b.y) + " " + px(W - b.x - b.w) + " " + px(H - b.y - b.h) + " " + px(b.x) + " round " + px(b.r) + ")";
/** The whole picture is shrunk into the box (cover-fit), not cropped by it. */
export const coverScale = (b: Box, W: number, H: number) => (W > 0 && H > 0 ? Math.max(b.w / W, b.h / H, 0.001) : 1);

/** While the gap opens, the photo flicks through the fleet before settling on the featured car. -1 = settled. */
export const flipAt = (p: number, faces: number) => (p > INTRO.flip[0] && p < INTRO.flip[1] ? Math.floor(span(p, INTRO.flip) * 16) % faces : -1);

/* ---- scene 4: a trip-kit card flies from the "why AFN" column, through the gap in the kit title, into its slot */
export type Rect = { x: number; y: number; w: number };
export function flightAt(k: number, a: Rect, mid: Rect, b: Rect): Rect {
  if (k <= 0.5) {
    const t = smooth(k / 0.5);
    return { x: lerp(a.x, mid.x, t), y: lerp(a.y, mid.y, t), w: lerp(a.w, mid.w, t) };
  }
  const t = smooth((k - 0.5) / 0.5);
  return { x: lerp(mid.x, b.x, t), y: lerp(mid.y, b.y, t), w: lerp(mid.w, b.w, t) };
}
/** How wide the title's gap is while the card passes through it (0 → 1 → 0). */
export const titleGapAt = (k: number) => smooth(span(k, [0.15, 0.45])) * (1 - smooth(span(k, [0.62, 0.92])));

/* ---- scene 6: the car-class drum. Integer = a class dead centre; each one holds before the drum turns on. */
export function drumAt(p: number, n: number) {
  if (n < 2) return 0;
  const raw = span(p, ZOOM.drum) * (n - 1);
  const k = Math.min(n - 2, Math.floor(raw));
  return k + smooth((raw - k - 0.2) / 0.6);
}
/** The scroll progress at which class i sits dead centre. */
export const drumHold = (i: number, n: number) => ZOOM.drum[0] + (ZOOM.drum[1] - ZOOM.drum[0]) * (n < 2 ? 0 : i / (n - 1));
/** Floating thumbnails drift up and wrap, in stage heights. */
export const floatY = (base: number, q: number, speed: number) => {
  const v = (((base - q * speed) % 1.3) + 1.3) % 1.3;
  return v - 0.15;
};

/* ---- scene 5: giant words. Column offset, band centre (px) and each word's "still arriving" amount. */
export function wordsAt(p: number, q: number, H: number, n: number) {
  const col = lerp(WORDS.from, WORDS.to, p) * H;
  const band = (p <= 0 ? lerp(-0.1, 0.75, q) : p < 0.65 ? lerp(0.75, 0.45, p / 0.65) : lerp(0.45, -0.75, (p - 0.65) / 0.35)) * H;
  const e: number[] = [];
  for (let k = 0; k < n; k++) e.push(clamp01((col + k * WORDS.gap * H - 0.5 * H) / (0.45 * H)));
  return { col, band, e };
}

/* ---- scene 7: the photo pile */
export const pileCount = (p: number, n: number) => Math.min(n, Math.floor(span(p, PILE.drop) * n + 1e-9));

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The untouched pile's centre, in fractions of the stage. */
export const PILE_AT = { x: 0.68, y: 0.68 } as const;
/** Where tile k lands in the untouched pile (a loose cluster); a new seed reshuffles it. */
export function pileSpot(k: number, seed: number) {
  const r = mulberry32(seed * 977 + k * 131 + 7);
  const a = r() * Math.PI * 2;
  const d = Math.sqrt(r());
  return { x: PILE_AT.x + Math.cos(a) * d * 0.1, y: PILE_AT.y + Math.sin(a) * d * 0.14, rot: (r() - 0.5) * 16 };
}

/* ---- reduced motion: the scroll cuts between still poses instead of playing the motion */
export const REDUCED = {
  intro: [
    [0, 0],
    [0.3, 0.79],
  ],
  pile: [
    [0, 0.3],
    [0.5, 1],
  ],
} as const;
export function poseFor(p: number, poses: readonly (readonly [number, number])[]) {
  let v = poses[0][1];
  for (const [at, val] of poses) if (p >= at) v = val;
  return v;
}
export function zoomPoses(n: number) {
  const out: [number, number][] = [[0, 0]];
  for (let i = 0; i < n; i++) out.push([0.1 + (0.75 * i) / n, drumHold(i, n)]);
  return out;
}

/** The next resting point below the current scroll position, or -1 (for the "next" button). */
export const nextStop = (stops: number[], y: number) => {
  for (const s of stops) if (s > y + 8) return s;
  return -1;
};
