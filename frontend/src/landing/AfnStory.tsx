/*
 * AFN landing: a scroll-driven story in eight scenes.
 * Scroll stays native (sticky stages, no wheel or scroll hijacking); only visuals are eased toward the real
 * scroll position. Pointer effects run only with (hover: hover) and (pointer: fine); reduced motion cuts
 * between still poses.
 *
 * Structure and motion adapted from "Curated Recommendations Scroll Landing Page" by Kedhareswer Naidu
 * (MIT, Copyright (c) 2026 Kedhareswer Naidu, see LICENSE-loupe.txt). Content, palette and photos are AFN's.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, isDemo } from "../lib/api";
import { CATEGORIES, EXTRAS, asset } from "../lib/shared";
import { useApp } from "../lib/store";
import type { Car } from "../lib/types";
import { demo } from "../lib/demo";
import {
  FIELD,
  flyAt,
  INTRO,
  PILE,
  PILE_AT,
  REDUCED,
  TRACK,
  ZOOM,
  approach,
  clamp01,
  coverAt,
  coverScale,
  drumAt,
  drumHold,
  fieldLayout,
  flightAt,
  flipAt,
  floatY,
  insetOf,
  lerp,
  nextStop,
  pileCount,
  pileSpot,
  poseFor,
  progressFrom,
  smooth,
  span,
  titleGapAt,
  wordsAt,
  zoomBox,
  zoomPoses,
  type Rect,
} from "./story";
import { FAQ } from "./faq";
import "./story.css";

/* ------------------------------------------------------------------ content */

const photo = (n: number) => asset(`img/u/t${String(n).padStart(2, "0")}.webp`);
const FIELD_PHOTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(photo);
const FLICK = [photo(9), photo(3), photo(14), photo(17), photo(2), photo(13), photo(6), photo(4)];
const PILE_PHOTOS = [6, 12, 2, 16, 9, 11, 1, 17, 4, 10, 13, 8, 3, 14, 15, 5, 18, 7].map(photo);

const SCENES: Record<string, string> = {
  Ekonom: "ekonom",
  Biznes: "biznes",
  Premium: "premium",
  "Krossover və SUV": "suv",
  Avtobuslar: "avtobus",
};
const sceneSrc = (cat: string, w: 800 | 1600) => asset(`img/u/s-${SCENES[cat]}-${w}.webp`);

/** Trip-kit tiles: brand gradients with a line icon (no photos needed). */
const KIT_LOOK: Record<string, { g: [string, string]; icon: ReactNode }> = {
  gps: { g: ["#eb571c", "#c2430f"], icon: <path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /> },
  "child-seat": { g: ["#3a3a3c", "#1d1d1f"], icon: <path d="M8 3h5a3 3 0 0 1 3 3v6l3 3v3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 9h8M10 18v3m6-3v3" /> },
  "extra-driver": { g: ["#5a5959", "#2b2b2e"], icon: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 9a5 5 0 0 1 10 0M16 11a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3-4.6" /> },
  "full-insurance": { g: ["#c2430f", "#7a2a08"], icon: <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" /> },
  wifi: { g: ["#f08a5d", "#d24c14"], icon: <path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0M12 19.5h.01" /> },
  "roof-box": { g: ["#2b2b2e", "#5a5959"], icon: <path d="M7 6h10l2 3H5l2-3Zm-3 9 2-4h12l2 4v3H4v-3Zm3 3v2m10-2v2M7 15h2m6 0h2" /> },
};
const PICK_KEYS = ["full-insurance", "child-seat", "gps"]; // the last one flies into the grid
const GRID_KEYS = ["gps", "child-seat", "extra-driver", "full-insurance", "wifi", "roof-box"];
const COL_SPEED = [0, 0.22, 0.08];
const BIG_WORDS: [string, string][] = [
  ["Sür", "-14vw"],
  ["kəşf et", "-6vw"],
  ["qayıt", "8vw"],
];
const FLOATS: [number, number][] = [
  [4, 0.05],
  [14, 0.3],
  [5, 0.55],
  [17, 0.78],
  [3, 0.98],
  [11, 1.18],
];
const BITS = [
  [-0.19, -0.12], [0.16, -0.17], [0.22, 0.04], [-0.24, 0.1], [0.05, 0.21], [-0.08, -0.22], [0.27, -0.05],
  [-0.15, 0.2], [0.12, 0.13], [-0.28, -0.03], [0.02, -0.26], [0.19, 0.24], [-0.04, 0.27], [0.3, 0.16],
];


/* ------------------------------------------------------------------ helpers */

const Chevron = ({ d = "M3 4.5L6 7.5L9 4.5" }: { d?: string }) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Plus = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d={on ? "M2.5 6.2L5 8.6L9.6 3.4" : "M6 2V10M2 6H10"} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);
const letters = (text: string, key: string) =>
  text.split("").map((ch, i) => (
    <span key={key + i} className={ch === " " ? "st-sp" : undefined} style={{ "--i": i } as CSSProperties}>
      {ch === " " ? " " : ch}
    </span>
  ));
/** Letter spans grouped by word, with real spaces between words, so a long line can wrap on a phone. */
const wrapLetters = (text: string, key: string) => {
  let i = 0;
  return text.split(" ").flatMap((w, k) => {
    const start = i;
    i += w.length + 1;
    return [
      k > 0 ? " " : null,
      <span key={key + "w" + k} className="st-wd">
        {w.split("").map((ch, j) => (
          <span key={key + (start + j)} style={{ "--i": start + j } as CSSProperties}>
            {ch}
          </span>
        ))}
      </span>,
    ];
  });
};
const words = (text: string, delay: number, step: number) =>
  text.split(" ").flatMap((w, i) => [
    i > 0 ? " " : null,
    <span key={w + i} className="st-w" style={{ "--dl": (delay + i * step).toFixed(2) + "s" } as CSSProperties}>
      {w}
    </span>,
  ]);

type El = HTMLElement | SVGElement;
type Flight = { a: Rect; m: Rect; b: Rect };
const FIELD_PTS = fieldLayout(FIELD_PHOTOS.length, 11);

/* ------------------------------------------------------------------ component */

export default function AfnStory({ height = "100svh" }: { height?: string }) {
  const { session, draft, toggleExtra, say } = useApp();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const els = useRef({} as Record<string, El | null>);
  const reg = (k: string) => (el: El | null) => {
    els.current[k] = el;
  };

  // the fleet: demo data at once, replaced by the API's cars (real ids) when they arrive
  const [cars, setCars] = useState<Car[]>([]);
  const [liveIds, setLiveIds] = useState(isDemo());
  useEffect(() => {
    demo.cars().then((c) => setCars((cur) => (cur.length ? cur : c)));
    api
      .cars()
      .then((c) => {
        setCars(c);
        setLiveIds(true);
      })
      .catch(() => null);
  }, []);
  const carLink = (c: Car) => (liveIds ? `/park/${c.id}` : `/park?q=${encodeURIComponent(c.model)}`);
  const featured = useMemo(() => {
    const f = cars.filter((c) => c.featured);
    return f.length ? f.slice(0, 3) : cars.slice(0, 3);
  }, [cars]);
  const classes = useMemo(
    () =>
      CATEGORIES.map((name) => {
        const list = cars.filter((c) => c.category === name);
        return { name, cars: list, from: list.length ? Math.min(...list.map((c) => c.pricePerDay)) : 0 };
      }),
    [cars]
  );

  const [feat, setFeat] = useState(0);
  const [col, setCol] = useState(0);
  const [seed, setSeed] = useState(1);
  const [still, setStill] = useState(false);
  const s = useRef({
    W: 0,
    H: 0,
    tw: 120,
    off: {} as Record<string, number>,
    len: {} as Record<string, number>,
    thumbs: [] as El[],
    words: [] as El[],
    floats: [] as El[],
    tiles: [] as El[],
    cols: [] as El[],
    scenes: [] as El[],
    flight: null as Flight | null,
    fine: false,
    still: false,
    ready: false,
    top: 0,
    last: 0,
    clock: 0,
    feat: 0,
    col: 0,
    fk: -1,
    count: -1,
    pileOn: false,
    pileTop: 0,
    sw: 0,
    user: false,
    spawn: 0,
    z: 100,
    topTile: PILE_PHOTOS.length - 1,
    kind: 0,
    lx: -999,
    ly: -999,
    label: "",
    magnet: null as HTMLElement | null,
    magnetBox: null as DOMRect | null,
    raf: 0,
    cache: new WeakMap() as WeakMap<object, Record<string, string>>,
  });
  s.current.feat = feat;

  const put = (el: El | null | undefined, prop: string, val: string) => {
    if (!el) return;
    const c = s.current.cache;
    let m = c.get(el);
    if (!m) c.set(el, (m = {}));
    if (m[prop] === val) return;
    m[prop] = val;
    if (prop.charCodeAt(0) === 45) el.style.setProperty(prop, val);
    else (el.style as unknown as Record<string, string>)[prop] = val;
  };
  const flag = (el: El | null | undefined, name: string, on: boolean) => {
    if (!el) return;
    if (on !== el.hasAttribute(name)) {
      if (on) el.setAttribute(name, "");
      else el.removeAttribute(name);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fp = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      s.current.still = rm.matches;
      s.current.fine = fp.matches;
      setStill(rm.matches);
    };
    sync();
    rm.addEventListener("change", sync);
    fp.addEventListener("change", sync);
    return () => {
      rm.removeEventListener("change", sync);
      fp.removeEventListener("change", sync);
    };
  }, []);

  // ---- the frame: one layout read (the root's top), eased for inertia, then style writes only
  const frame = (now: number) => {
    const st = s.current;
    st.raf = 0;
    const root = rootRef.current;
    if (!root || !st.H) return;
    const dt = st.last ? Math.min(64, now - st.last) : 16;
    st.last = now;
    const raw = root.getBoundingClientRect().top;
    st.top = !st.ready || st.still ? raw : approach(st.top, raw, dt, 85);
    st.ready = true;
    let again = Math.abs(st.top - raw) > 0.4;
    const top = st.top;
    const W = st.W;
    const H = st.H;
    const e = els.current;
    const at = (k: string) => top + (st.off[k] || 0);
    const seen = (k: string) => at(k) < H && at(k) + (st.len[k] || 0) > 0;
    const pin = (k: string) => progressFrom(at(k), st.len[k] || 0, H);

    // 1–3 · the photo field, the gap, the studio, the featured car
    if (seen("intro")) {
      let p = pin("intro");
      if (st.still) p = poseFor(p, REDUCED.intro);
      else {
        st.clock += dt / 1000;
        again = true;
      }
      const fade = 1 - span(p, [0.16, 0.28]);
      const cam = span(p, INTRO.fly) * FIELD.travel + st.clock * FIELD.idle;
      const tw = st.tw;
      st.thumbs.forEach((el, j) => {
        const f = FIELD_PTS[j];
        if (!f) return;
        const q = flyAt(f.x, f.y, f.z, cam, W, H);
        // a photo passing behind the headline steps back so the words stay readable
        const behind = Math.abs(q.x - W / 2) < W * (W < 700 ? 0.5 : 0.24) && Math.abs(q.y - H / 2) < H * (W < 700 ? 0.16 : 0.11) ? 0.18 : 1;
        const o = q.o * fade * behind;
        put(el, "opacity", o.toFixed(3));
        if (o > 0.002) {
          put(el, "transform", "translate3d(" + (q.x - tw / 2).toFixed(1) + "px," + (q.y - tw * 0.625).toFixed(1) + "px,0) scale(" + (q.s * 1.2).toFixed(4) + ")");
          put(el, "zIndex", String(Math.min(150, Math.round(100 - q.d * 2))));
        }
      });
      const I = e.intro;
      const l1 = span(p, INTRO.lineOut);
      put(I, "--l1", l1.toFixed(3));
      put(e.l1, "filter", l1 > 0 && l1 < 1 ? "blur(" + (l1 * 10).toFixed(1) + "px)" : "none");
      const w0 = Math.min(W * 0.14, 190);
      const b = zoomBox(span(p, INTRO.open), span(p, INTRO.grow), W, H, w0, w0 * 0.62);
      put(e.portrait, "clipPath", insetOf(b, W, H));
      put(e.portrait, "visibility", b.w < 1 ? "hidden" : "visible");
      put(e.portrait, "transform", "translate3d(0," + (-span(p, [coverAt(TRACK.intro), 1]) * H * 0.32).toFixed(1) + "px,0)");
      put(e.portraitIn, "transform", "scale(" + coverScale(b, W, H).toFixed(4) + ")");
      put(I, "--g", b.w.toFixed(1) + "px");
      put(I, "--cap", span(p, INTRO.caption).toFixed(3));
      put(I, "--capo", (1 - span(p, INTRO.captionOut)).toFixed(3));
      const c = span(p, INTRO.callouts);
      put(I, "--c", c.toFixed(3));
      put(I, "--s", smooth(span(p, INTRO.strip)).toFixed(3));
      const f = flipAt(p, FLICK.length);
      if (f >= 0 && f !== st.fk) {
        st.fk = f;
        (e.flick as HTMLImageElement | null)?.setAttribute("src", FLICK[f]);
      }
      flag(e.portrait, "data-flip", f >= 0);
      if (e.portrait && e.portrait.getAttribute("data-v") !== "v" + st.feat) e.portrait.setAttribute("data-v", "v" + st.feat);
      flag(e.callouts, "data-live", c > 0.6);
      flag(e.callouts, "inert", c <= 0.6);
    }

    // 4 · "why AFN" inks in; the kit panel rises; the last pick flies into the grid
    if (seen("mani") || seen("grid")) {
      put(e.mani, "--t", clamp01((H * 0.7 - at("mani")) / (H * 1.6)).toFixed(3));
      const gTop = at("grid");
      put(e.mani, "--dim", smooth(clamp01((H - gTop) / H)).toFixed(3));
      const k = st.still ? (gTop < H * 0.5 ? 1 : 0) : clamp01((H * 0.95 - gTop) / (H * 0.75));
      const fl = st.flight;
      if (fl) {
        const r = flightAt(k, fl.a, fl.m, fl.b);
        put(e.fly, "transform", "translate3d(" + r.x.toFixed(1) + "px," + r.y.toFixed(1) + "px,0) scale(" + (r.w / fl.a.w).toFixed(4) + ")");
        flag(e.fly, "data-on", k > 0 && k < 1);
        flag(e.flySrc, "data-away", k > 0);
        flag(e.flyDst, "data-away", k < 1);
        put(e.gtitle, "--tg", (titleGapAt(k) * fl.m.w * 1.06).toFixed(1) + "px");
      }
      const gp = clamp01((H - gTop) / ((st.len.grid || H) + H));
      st.cols.forEach((el, j) => put(el, "transform", "translate3d(0," + (st.still ? 0 : -gp * H * (COL_SPEED[j] || 0)).toFixed(1) + "px,0)"));
    }

    // 5 · giant words over the orange sweep
    if (seen("words")) {
      const q = clamp01((H - at("words")) / H);
      const p = st.still ? 0.4 : pin("words");
      const n = st.words.length;
      const w = wordsAt(p, q, H, n);
      put(e.wcol, "transform", "translate3d(0," + w.col.toFixed(1) + "px,0)");
      put(e.sweep, "transform", "translate3d(0," + (st.still ? H * 0.42 : w.band - H * 0.25).toFixed(1) + "px,0) rotate(-8deg)");
      st.words.forEach((el, k) => put(el, "--e", (st.still ? 0 : w.e[k]).toFixed(3)));
      put(e.wcol, "--dd", (st.still ? 1 : clamp01(1 - w.e[n - 1] * 2.4)).toFixed(3));
    }

    // 6 · second zoom → the car-class drum
    if (seen("zoom")) {
      let p = pin("zoom");
      const n = CATEGORIES.length;
      if (st.still) p = poseFor(p, zoomPoses(n));
      const Z = e.zoom;
      const w0 = Math.min(W * 0.1, 130);
      const b = zoomBox(span(p, ZOOM.open), span(p, ZOOM.grow), W, H, w0, w0 * 0.66);
      put(e.scenes, "clipPath", insetOf(b, W, H));
      put(e.scenes, "visibility", b.w < 1 ? "hidden" : "visible");
      put(e.scenesIn, "transform", "scale(" + coverScale(b, W, H).toFixed(4) + ")");
      put(Z, "--g", b.w.toFixed(1) + "px");
      const u = smooth(span(p, ZOOM.ui));
      put(Z, "--u", u.toFixed(3));
      const a = drumAt(p, n);
      put(Z, "--a", a.toFixed(4));
      // only the scene arriving is blurred; anything fully covered is not drawn at all
      const sv = st.scenes.map((_, i) => clamp01((a - i + 0.6) * 2));
      st.scenes.forEach((el, i) => {
        const v = sv[i];
        const hidden = v <= 0 || (i + 1 < sv.length && sv[i + 1] >= 1);
        put(el, "visibility", hidden ? "hidden" : "visible");
        if (hidden) return;
        put(el, "opacity", v.toFixed(3));
        put(el, "filter", v < 1 && !st.still ? "blur(" + ((1 - v) * 18).toFixed(1) + "px)" : "none");
        put(el, "transform", "scale(" + (1.12 - 0.12 * clamp01(a - i + 1)).toFixed(4) + ")");
      });
      const q = span(p, ZOOM.drum);
      st.floats.forEach((el, j) => put(el, "transform", "translate3d(0," + (floatY(FLOATS[j] ? FLOATS[j][1] : 0, q, 1.3 + j * 0.18) * H).toFixed(1) + "px,0)"));
      flag(e.ui, "data-live", u > 0.6);
      flag(e.ui, "inert", u <= 0.6);
      const k = Math.round(a);
      if (k !== st.col) {
        st.col = k;
        setCol(k);
      }
    }

    // 7 · the photo trail gathers into a pile; the booking call to action
    st.pileOn = seen("pile");
    const fd = clamp01((H - at("foot")) / (H * 0.62));
    if (st.pileOn) {
      let p = pin("pile");
      if (st.still) p = poseFor(p, REDUCED.pile);
      const pa = at("pile");
      st.pileTop = pa > 0 ? pa : Math.min(0, pa + (st.len.pile || 0) - H);
      const P = e.pile;
      put(P, "--t", span(p, PILE.ink).toFixed(3));
      const sw = smooth(span(p, PILE.swap));
      st.sw = sw;
      put(P, "--sw", sw.toFixed(3));
      put(P, "--ty", span(p, PILE.type).toFixed(3));
      put(P, "--fd", fd.toFixed(3));
      put(e.pf, "--g", sw.toFixed(3));
      put(e.pf, "--cx", (lerp(PILE_AT.x, 0.5, sw) * W).toFixed(1) + "px");
      put(e.pf, "--cy", (lerp(PILE_AT.y, lerp(0.33, 0.17, fd), sw) * H).toFixed(1) + "px");
      flag(e.pf, "data-bits", p > 0.06);
      const n = st.tiles.length;
      const count = pileCount(p, n);
      if (count !== st.count) {
        st.count = count;
        st.tiles.forEach((t, k) => {
          if (k < count) t.setAttribute("data-on", "");
          else if (!st.user) t.removeAttribute("data-on");
        });
      }
      flag(e.cta, "data-off", sw < 0.6);
      flag(e.cta, "inert", sw < 0.6);
    }

    // 8 · footer: the road line draws itself; the floating nav steps aside
    put(e.foot, "--f", fd.toFixed(3));
    put(e.chrome, "--hide", smooth(clamp01(fd * 1.6)).toFixed(3));
    flag(e.nav, "data-off", fd > 0.4);

    if (again) schedule();
  };

  const schedule = () => {
    if (!s.current.raf && typeof window !== "undefined") s.current.raf = window.requestAnimationFrame(frame);
  };

  // the untouched pile: a loose trail of photos, revealed by scroll
  const layoutPile = () => {
    const st = s.current;
    st.tiles.forEach((t, k) => {
      const sp = pileSpot(k, seed);
      t.style.setProperty("--x", (sp.x * st.W).toFixed(1) + "px");
      t.style.setProperty("--y", (sp.y * st.H).toFixed(1) + "px");
      t.style.setProperty("--r", sp.rot.toFixed(1) + "deg");
    });
  };

  const measureRef = useRef<() => void>(() => undefined);
  // measure on mount and on resize; never inside the frame
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;
    const st = s.current;
    const offIn = (el: HTMLElement | null) => {
      let x = 0;
      let y = 0;
      let n = el;
      while (n && n !== root) {
        x += n.offsetLeft;
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      return { x, y };
    };
    const measure = () => {
      const stage = els.current.introStage as HTMLElement | null;
      st.W = root.clientWidth;
      st.H = stage ? stage.clientHeight : window.innerHeight;
      for (const k of ["intro", "mani", "grid", "words", "zoom", "pile", "foot"]) {
        const el = els.current[k] as HTMLElement | null;
        st.off[k] = el ? el.offsetTop : 0;
        st.len[k] = el ? el.offsetHeight : 0;
      }
      st.thumbs = Array.from(root.querySelectorAll("[data-th]")) as El[];
      st.tw = st.thumbs[0] ? (st.thumbs[0] as HTMLElement).offsetWidth : 120;
      st.words = Array.from(root.querySelectorAll("[data-word]")) as El[];
      st.floats = Array.from(root.querySelectorAll("[data-float]")) as El[];
      st.tiles = Array.from(root.querySelectorAll("[data-tile]")) as El[];
      st.cols = Array.from(root.querySelectorAll("[data-gcol]")) as El[];
      st.scenes = Array.from(root.querySelectorAll("[data-scene]")) as El[];
      const src = (els.current.flySrc as HTMLElement | null)?.firstElementChild as HTMLElement | null;
      const dst = (els.current.flyDst as HTMLElement | null)?.firstElementChild as HTMLElement | null;
      const ttl = els.current.gtitle as HTMLElement | null;
      if (src && dst && ttl && src.offsetWidth > 0 && dst.offsetWidth > 0) {
        const a = offIn(src);
        const b = offIn(dst);
        const t = offIn(ttl);
        const mw = dst.offsetWidth * 0.62;
        st.flight = {
          a: { x: a.x, y: a.y, w: src.offsetWidth },
          m: { x: t.x + ttl.offsetWidth / 2 - mw / 2, y: t.y + ttl.offsetHeight / 2 - (mw * 1.25) / 2, w: mw },
          b: { x: b.x, y: b.y, w: dst.offsetWidth },
        };
        const fly = els.current.fly as HTMLElement | null;
        if (fly) fly.style.width = src.offsetWidth + "px";
      } else st.flight = null;
      if (!st.user) layoutPile();
      st.count = -1;
      st.cache = new WeakMap();
      schedule();
    };
    measureRef.current = measure;
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(root);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", schedule, { passive: true });
    document.fonts?.ready.then(measure).catch(() => null);
    // the pile flips through photos once it has gathered
    const flip = window.setInterval(() => {
      if (!st.pileOn || st.still || st.sw < 0.4) return;
      const t = st.tiles[st.topTile];
      const img = t ? (t.firstElementChild as HTMLImageElement | null) : null;
      if (img) img.src = PILE_PHOTOS[st.kind++ % PILE_PHOTOS.length];
    }, 170);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", schedule);
      window.clearInterval(flip);
      if (st.raf) window.cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // new data changes the layout (deck, floats): measure again
  useEffect(() => {
    measureRef.current();
  }, [cars.length, col]);

  // state the frame reads: re-run it when it changes
  useEffect(() => {
    const st = s.current;
    st.count = -1;
    st.user = false;
    layoutPile();
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feat, still, seed]);

  // ---- jumps (a click may read layout; the frame may not). Plain window.scrollTo: the user can always scroll on.
  const scrollToY = (y: number) => window.scrollTo({ top: Math.max(0, y), behavior: s.current.still ? "auto" : "smooth" });
  const absTop = () => (rootRef.current ? rootRef.current.getBoundingClientRect().top + window.scrollY : 0);
  const travel = (k: string) => (s.current.len[k] || 0) - s.current.H;
  const jumpToClass = (i: number) => scrollToY(absTop() + s.current.off.zoom + drumHold(i, CATEGORIES.length) * travel("zoom"));
  // arrow keys spin the drum one class at a time; focus follows (roving tabindex)
  const onDrumKey = (ev: ReactKeyboardEvent<HTMLDivElement>) => {
    const n = CATEGORIES.length;
    const step = ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : ev.key === "ArrowUp" || ev.key === "ArrowLeft" ? -1 : 0;
    const to = ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, s.current.col + step));
    if (!step && ev.key !== "Home" && ev.key !== "End") return;
    ev.preventDefault();
    jumpToClass(to);
    s.current.col = to;
    setCol(to);
    ((els.current.drum as HTMLElement | null)?.children[to] as HTMLElement | undefined)?.focus({ preventScroll: true });
  };
  const next = () => {
    const st = s.current;
    const base = absTop();
    const stops = [
      base + st.off.intro + 0.4 * travel("intro"),
      base + st.off.intro + 0.72 * travel("intro"),
      base + st.off.mani + st.H,
      base + st.off.grid + st.H * 0.3,
      base + st.off.words + 0.45 * travel("words"),
      base + st.off.zoom + 0.06 * travel("zoom"),
      base + st.off.zoom + drumHold(0, CATEGORIES.length) * travel("zoom"),
      base + st.off.pile + 0.3 * travel("pile"),
      base + st.off.pile + 0.8 * travel("pile"),
      base + st.off.foot,
    ];
    const y = nextStop(stops, window.scrollY);
    scrollToY(y < 0 ? base : y);
  };

  const pick = (key: string) => {
    const e = EXTRAS.find((x) => x.key === key);
    const on = toggleExtra(key);
    if (e) say(on ? `${e.name} rezervasiyaya əlavə olundu` : `${e.name} çıxarıldı`);
  };

  // a photo drops where the cursor is; a trail of them becomes the pile
  const spawn = (x: number, y: number) => {
    const st = s.current;
    const n = st.tiles.length;
    if (!n) return;
    const k = st.spawn++ % n;
    const t = st.tiles[k] as HTMLElement;
    t.setAttribute("data-jump", "");
    t.style.setProperty("--x", x.toFixed(1) + "px");
    t.style.setProperty("--y", y.toFixed(1) + "px");
    t.style.setProperty("--r", ((Math.random() - 0.5) * 14).toFixed(1) + "deg");
    t.style.zIndex = String(++st.z);
    t.setAttribute("data-on", "");
    st.topTile = k;
    st.user = true;
    const img = t.firstElementChild as HTMLImageElement | null;
    if (img) {
      img.src = PILE_PHOTOS[st.kind++ % PILE_PHOTOS.length];
      img.animate?.([{ transform: "scale(1.35)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.2,1.3,.4,1)" });
    }
  };

  // ---- pointer: context cursor, magnets, the photo trail. Mouse only.
  const release = () => {
    const st = s.current;
    const m = st.magnet;
    if (m) {
      m.style.transform = "";
      const inner = m.firstElementChild as HTMLElement | null;
      if (inner) inner.style.transform = "";
      m.removeAttribute("data-near");
    }
    st.magnet = null;
    st.magnetBox = null;
  };
  const onMove = (ev: ReactPointerEvent) => {
    const st = s.current;
    if (ev.pointerType !== "mouse" || !st.fine) return;
    const cur = cursorRef.current;
    if (cur) {
      cur.style.transform = "translate3d(" + ev.clientX + "px," + ev.clientY + "px,0)";
      cur.setAttribute("data-on", "");
    }
    const t = ev.target as Element;
    const hit = t.closest ? (t.closest("[data-cursor]") as HTMLElement | null) : null;
    const label = hit ? hit.getAttribute("data-cursor") || "" : "";
    if (label !== st.label) {
      st.label = label;
      if (labelRef.current && label) labelRef.current.textContent = label;
      if (cur) {
        if (label) cur.setAttribute("data-label", "");
        else cur.removeAttribute("data-label");
      }
    }
    const mag = t.closest ? (t.closest("[data-magnet]") as HTMLElement | null) : null;
    if (mag !== st.magnet) {
      release();
      if (mag) {
        st.magnet = mag;
        st.magnetBox = mag.getBoundingClientRect();
        mag.setAttribute("data-near", "");
      }
    }
    if (st.magnet && st.magnetBox && !st.still) {
      const bx = st.magnetBox;
      const dx = ev.clientX - (bx.left + bx.width / 2);
      const dy = ev.clientY - (bx.top + bx.height / 2);
      st.magnet.style.transform = "translate(" + (dx * 0.3).toFixed(1) + "px," + (dy * 0.38).toFixed(1) + "px)";
      const inner = st.magnet.firstElementChild as HTMLElement | null;
      if (inner) inner.style.transform = "translate(" + (dx * 0.12).toFixed(1) + "px," + (dy * 0.14).toFixed(1) + "px)";
    }
    if (st.pileOn && !st.still && st.sw < 0.45) {
      const y = ev.clientY - st.pileTop;
      if (y > 0 && y < st.H * 0.92 && Math.hypot(ev.clientX - st.lx, y - st.ly) > 52) {
        st.lx = ev.clientX;
        st.ly = y;
        spawn(ev.clientX, y);
      }
    }
  };
  const onLeave = () => {
    release();
    cursorRef.current?.removeAttribute("data-on");
  };

  /* ---- copy */
  const fc = featured[Math.min(feat, featured.length - 1)];
  const deck = fc ? cars.filter((c) => c.category === fc.category && c.id !== fc.id).concat(cars.filter((c) => c.category !== fc.category)).slice(0, 4) : [];
  const cls = classes[Math.max(0, Math.min(classes.length - 1, col))];
  const paraA = "AFN ilə avtomobil götürmək sadədir:".split(" ");
  const boxWords = ["qiymət", "əvvəlcədən", "bəllidir."];
  const paraC = "Bütün avtomobillər sığortalıdır, şəxsi menecer sifarişinizi başdan sona izləyir, dəstək isə 7/24 işləyir.".split(" ");
  const inkN = paraA.length + boxWords.length + paraC.length;
  const pileA = "Hava limanı. Bölgələr. Toy.".split(" ");
  const pileB = "Hər yol üçün bir avtomobil.".split(" ");
  const pileN = pileA.length + pileB.length;
  const ctaText = "Avtomobilinizi bu gün rezerv edin";
  const caption = `Ekonomdan premiuma – ${cars.length || 13} avtomobil, bir park`;
  const extraOf = (k: string) => EXTRAS.find((e) => e.key === k)!;

  const kitCard = (key: string, id: string, refKey?: string) => {
    const e = extraOf(key);
    const look = KIT_LOOK[key];
    const on = draft.extras.includes(key);
    return (
      <button
        type="button"
        key={id}
        ref={refKey ? reg(refKey) : undefined}
        className="st-card"
        onClick={() => pick(key)}
        data-cursor={on ? "Seçilib" : "Əlavə et"}
        aria-pressed={on}
        aria-label={`${e.name}, ${e.pricePerDay} AZN gündəlik – rezervasiyaya ${on ? "əlavə olunub" : "əlavə et"}`}
      >
        <span className="st-pic">
          <span className="st-kit" style={{ "--g1": look.g[0], "--g2": look.g[1] } as CSSProperties}>
            <span className="st-caps">{e.pricePerDay} AZN / gün</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {look.icon}
            </svg>
          </span>
          <span className="st-plus" data-on={on ? "" : undefined}>
            <Plus on={on} />
          </span>
        </span>
        <span className="st-cname">{e.name}</span>
        <span className="st-cmeta st-caps">{e.description}</span>
      </button>
    );
  };

  const fly = KIT_LOOK[PICK_KEYS[PICK_KEYS.length - 1]];
  const accountLink = session ? (session.user.role === "admin" ? "/admin" : "/hesab") : "/daxil-ol";

  return (
    <div
      ref={rootRef}
      className="st-root"
      style={{ "--h": height } as CSSProperties}
      data-still={still ? "" : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <a className="st-skip" href="#why">
        Animasiyanı keç
      </a>

      {/* floating chrome */}
      <div className="st-chrome" ref={reg("chrome")}>
        <div className="st-chrome-in">
          <span className="st-launch st-caps">Bakı · hər gün 09:00–21:00</span>
          <nav className="st-nav" ref={reg("nav")} aria-label="Əsas menyu">
            <Link to="/" className="st-wordmark" aria-label="AFN rent a car – ana səhifə">
              <img src={asset("fotos/logo.png")} alt="AFN rent a car" width={150} height={42} translate="no" />
            </Link>
            <Link to="/park" className="st-btn" data-cursor="Avtopark">
              Avtopark
            </Link>
            <Link to={accountLink} className="st-btn" data-cursor="Hesab">
              {session ? "Hesab" : "Daxil ol"}
            </Link>
            <Link to="/rezervasiya" className="st-btn st-btn-accent" data-magnet="" data-cursor="Rezerv et">
              <span>Rezerv et</span>
            </Link>
          </nav>
          <button type="button" className="st-scroll st-caps" onClick={next} data-cursor="Növbəti" aria-label="Növbəti hissəyə keç">
            <span className="st-scroll-label">Növbəti</span>
            <i>
              <Chevron />
            </i>
          </button>
        </div>
      </div>

      {/* 1–3 · photo field → the gap → the featured car */}
      <section className="st-track" ref={reg("intro")} style={{ "--len": TRACK.intro } as CSSProperties} aria-label="Giriş">
        <div className="st-stage" ref={reg("introStage")}>
          {FIELD_PHOTOS.map((src, j) => (
            <div key={j} className="st-th" data-th="">
              <img className="st-img" src={src} alt="" width={320} height={400} decoding="async" draggable={false} />
            </div>
          ))}
          <h1 className="st-h1 st-l1">
            <span ref={reg("l1")}>
              <span className="sr-only" translate="no">
                AFN rent a car –{" "}
              </span>
              {words("Bakıda avtomobil", 0.1, 0.16)} <em>{words("icarəsi", 0.42, 0)}</em>
            </span>
          </h1>
          <p className="st-h1 st-l2" aria-hidden="true">
            <span className="st-wl">{words("bir klik", 0.85, 0.16)}</span>
            <span className="st-wr">{words("uzağınızda", 1.2, 0)}</span>
          </p>
          <div className="st-full" ref={reg("portrait")} data-v="v0" style={{ clipPath: "inset(50%)" }}>
            <div className="st-zin" ref={reg("portraitIn")}>
              {featured.map((c, k) => (
                <div key={c.id} className={"st-pv st-pv" + k}>
                  <span className="st-floor" />
                  <img className="st-car" src={asset(c.image)} alt={k === feat ? `${c.model}, ${c.year}` : ""} width={700} height={467} draggable={false} />
                </div>
              ))}
              <img className="st-img st-flick" ref={reg("flick")} src={FLICK[0]} alt="" draggable={false} />
            </div>
            <span className="st-capbg" />
            <p className="st-cap" style={{ "--n": caption.length } as CSSProperties} aria-label={caption}>
              {wrapLetters(caption, "cap")}
            </p>
            {fc && (
              <div className="st-co" ref={reg("callouts")} aria-label="Seçilmiş avtomobil">
                <svg className="st-vx" aria-hidden="true">
                  <line x1="36%" y1="62%" x2="15%" y2="58%" pathLength={1} />
                  <line x1="55%" y1="42%" x2="68%" y2="27%" pathLength={1} />
                  <line x1="67%" y1="63%" x2="80%" y2="57%" pathLength={1} />
                  <circle cx="36%" cy="62%" r="4" />
                  <circle cx="55%" cy="42%" r="4" />
                  <circle cx="67%" cy="63%" r="4" />
                </svg>
                <div className="st-head">
                  <p className="st-caps m-0">{fc.category} · seçilmiş avtomobil</p>
                  <h2 translate="no">{fc.model}</h2>
                </div>
                <div className="st-specs">
                  <span className="st-spec" style={{ left: "15%", top: "58%", "--tx": "-100%", "--k": 0 } as CSSProperties}>
                    {fc.seats} yer
                  </span>
                  <span className="st-spec" style={{ left: "68%", top: "27%", "--k": 1 } as CSSProperties}>
                    {fc.fuelType} · {fc.engine} L
                  </span>
                  <span className="st-spec" style={{ left: "80%", top: "57%", "--k": 2 } as CSSProperties}>
                    {fc.transmission}
                  </span>
                </div>
                <p className="st-bio">
                  {fc.description} Buraxılış ili {fc.year}.
                  <strong>{fc.pricePerDay} AZN / gün</strong>
                  <Link to={carLink(fc)} className="st-hit" data-cursor="Ətraflı">
                    Ətraflı və rezerv et →
                  </Link>
                </p>
                <div className="st-dots" role="group" aria-label="Seçilmiş avtomobillər">
                  {featured.map((c, k) => (
                    <button key={c.id} type="button" className="st-dot st-hit" aria-label={c.model} aria-current={k === feat ? "true" : undefined} onClick={() => setFeat(k)} data-cursor={c.model} />
                  ))}
                </div>
                <button
                  type="button"
                  className="st-btn st-btn-accent st-next st-hit"
                  data-magnet=""
                  data-cursor="Növbəti avtomobil"
                  aria-label="Növbəti avtomobil"
                  onClick={() => setFeat((k) => (k + 1) % Math.max(1, featured.length))}
                >
                  <span>
                    <Chevron d="M4.5 3L7.5 6L4.5 9" />
                  </span>
                </button>
                <div className="st-deck">
                  <span className="st-deck-label st-caps">Alternativlər</span>
                  {deck.map((c, j) => (
                    <Link key={fc.id + "-" + c.id} to={carLink(c)} className="st-sc st-hit" style={{ "--k": j } as CSSProperties} data-cursor={c.model} aria-label={`${c.model}, ${c.pricePerDay} AZN/gün`}>
                      <img className="st-img" src={asset(c.image)} alt="" loading="lazy" width={700} height={467} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4 · why AFN, slides over the pinned studio */}
      <section className="st-mani" id="why" ref={reg("mani")} aria-labelledby="why-h">
        <h2 id="why-h" className="st-kicker st-caps">
          Niyə AFN?
        </h2>
        <p className="st-para" style={{ "--n": inkN } as CSSProperties}>
          {paraA.map((w, i) => (
            <span key={"a" + i} className="st-ink" style={{ "--i": i } as CSSProperties}>
              {w}{" "}
            </span>
          ))}
          <span className="st-box" style={{ "--i": paraA.length + boxWords.length - 1 } as CSSProperties}>
            {boxWords.map((w, i) => (
              <span key={"b" + i} className="st-ink" style={{ "--i": paraA.length + i } as CSSProperties}>
                {w}
                {i < boxWords.length - 1 ? " " : ""}
              </span>
            ))}
          </span>{" "}
          {paraC.map((w, i) => (
            <span key={"c" + i} className="st-ink" style={{ "--i": paraA.length + boxWords.length + i } as CSSProperties}>
              {w}{" "}
            </span>
          ))}
        </p>
        <div className="st-col">{PICK_KEYS.map((k, i) => kitCard(k, "pick-" + k, i === PICK_KEYS.length - 1 ? "flySrc" : undefined))}</div>
      </section>

      {/* the trip-kit panel; its first card arrives from the column above */}
      <section className="st-grid" ref={reg("grid")} aria-labelledby="kit-h">
        <div className="st-ghead">
          <span className="st-caps st-cmeta">Əlavələr</span>
          <h2 className="st-gtitle" id="kit-h" ref={reg("gtitle")}>
            <span>Səyahət</span>
            <i aria-hidden="true" />
            <span>dəstiniz</span>
          </h2>
          <div className="st-chips st-caps">
            <span>{EXTRAS.length} əlavə</span>
            <span>gündəlik qiymətlə</span>
          </div>
        </div>
        <div className="st-gr">
          {[0, 1, 2].map((cIdx) => (
            <div key={cIdx} className="st-gc" data-gcol="">
              {GRID_KEYS.map((k, i) => (i % 3 === cIdx ? kitCard(k, "grid-" + k, i === 0 ? "flyDst" : undefined) : null))}
            </div>
          ))}
        </div>
        <div className="st-kitcta">
          <span role="status" aria-live="polite">
            {draft.extras.length ? `Seçilib: ${draft.extras.length} əlavə` : "“+” ilə əlavələri rezervasiyaya qoşun"}
          </span>
          <Link to="/rezervasiya" className="st-btn st-btn-accent" data-magnet="" data-cursor="Rezervasiya">
            <span>Rezervasiyaya keç</span>
          </Link>
        </div>
      </section>

      {/* 5 · drive, explore, return */}
      <section className="st-track st-words" ref={reg("words")} style={{ "--len": TRACK.words } as CSSProperties} aria-label="Sür, kəşf et, qayıt">
        <div className="st-stage">
          <div className="st-sweep" ref={reg("sweep")} />
          <div className="st-wclip">
            <div className="st-wcol" ref={reg("wcol")}>
              {BIG_WORDS.map(([w, x], k) => (
                <p key={w} className="st-big" data-word="" aria-hidden="true" style={{ top: "calc(var(--h) * " + k * 0.85 + ")", "--x": x } as CSSProperties}>
                  <span>
                    {letters(w, "w" + k)}
                    {k === BIG_WORDS.length - 1 && (
                      <svg className="st-arrow" viewBox="0 0 40 40" aria-hidden="true">
                        <path pathLength={1} d="M30 30C30 14 22 8 8 10M8 10L15 4M8 10L14 17" />
                      </svg>
                    )}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6 · choose your class → the drum */}
      <section className="st-track" ref={reg("zoom")} style={{ "--len": TRACK.zoom } as CSSProperties} aria-labelledby="classes-h">
        <div className="st-stage">
          <p className="st-h1 st-l2" aria-hidden="true">
            <span className="st-wl">
              <span>Klassınızı</span>
            </span>
            <span className="st-wr">
              <span>seçin</span>
            </span>
          </p>
          <div className="st-full" ref={reg("scenes")} style={{ clipPath: "inset(50%)" }}>
            <div className="st-zin" ref={reg("scenesIn")}>
              {CATEGORIES.map((c) => (
                <div key={c} className="st-scene" data-scene="">
                  <img
                    className="st-img"
                    src={sceneSrc(c, 800)}
                    srcSet={`${sceneSrc(c, 800)} 800w, ${sceneSrc(c, 1600)} 1600w`}
                    sizes="100vw"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={1600}
                    height={1000}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
            <div className="st-ui" ref={reg("ui")}>
              <h2 id="classes-h" className="sr-only">
                Avtomobil klassları
              </h2>
              <svg className="st-vx" aria-hidden="true" style={{ "--c": "var(--u)" } as CSSProperties}>
                <line x1="20%" y1="50%" x2="44%" y2="0%" pathLength={1} />
                <line x1="20%" y1="50%" x2="40%" y2="100%" pathLength={1} />
              </svg>
              <span className="st-vlab st-caps" style={{ left: "20%", top: "50%", "--c": "var(--u)" } as CSSProperties}>
                Klass
              </span>
              <div className="st-drum" role="group" aria-label="Klass seçin (ox düymələri ilə dəyişin)" ref={reg("drum")} onKeyDown={onDrumKey}>
                {classes.map((c, k) => {
                  // two or more steps from the centre the class is faded out: not clickable, not focusable, not announced
                  const far = Math.abs(k - col) >= 2;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className="st-di st-hit"
                      style={{ "--i": k } as CSSProperties}
                      data-far={far ? "" : undefined}
                      aria-hidden={far ? true : undefined}
                      tabIndex={k === col ? 0 : -1}
                      aria-current={k === col ? "true" : undefined}
                      onClick={() => jumpToClass(k)}
                      data-cursor={k === col ? "Bu klass" : "Fırlat"}
                    >
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
              {cls && (
                <Link to={`/park?category=${encodeURIComponent(cls.name)}`} className="st-chip st-hit" data-cursor="Avtoparka bax">
                  <span>
                    <small className="st-caps">{cls.cars.length} avtomobil</small>
                    <b>{cls.name}</b>
                  </span>
                  <em>{cls.from ? `${cls.from} AZN-dən` : ""}</em>
                </Link>
              )}
              {cls &&
                FLOATS.map(([x], j) => {
                  const c = cls.cars[j % Math.max(1, cls.cars.length)];
                  return c ? (
                    <div key={col + "-" + j} className="st-ft" data-float="" style={{ right: x + "%" }} aria-hidden="true">
                      <img className="st-img" src={asset(c.image)} alt="" loading="lazy" width={700} height={467} />
                    </div>
                  ) : null;
                })}
            </div>
          </div>
        </div>
      </section>

      {/* 7 · photo trail → pile → book */}
      <section className="st-track st-pilesec" ref={reg("pile")} style={{ "--len": TRACK.pile } as CSSProperties} aria-labelledby="cta-h">
        <div className="st-stage">
          <div className="st-pf" ref={reg("pf")} onClick={() => setSeed((n) => n + 1)} data-cursor="Qarışdır" aria-hidden="true">
            {BITS.map((b, j) => (
              <i key={"b" + j} className="st-bit" style={{ "--bx": (b[0] * 55).toFixed(0) + "vw", "--by": "calc(var(--h) * " + (b[1] * 0.75).toFixed(3) + ")", "--dl": (j * 0.19).toFixed(2) + "s" } as CSSProperties} />
            ))}
            {PILE_PHOTOS.map((src, j) => (
              <span key={j} className="st-tile" data-tile="" style={{ zIndex: j }}>
                <img className="st-img" src={src} alt="" loading="lazy" decoding="async" width={320} height={400} draggable={false} />
              </span>
            ))}
          </div>
          <p className="st-pl st-pab" style={{ "--n": pileN } as CSSProperties}>
            {pileA.map((w, i) => (
              <span key={"a" + i} className="st-ink" style={{ "--i": i } as CSSProperties}>
                {w}{" "}
              </span>
            ))}
            <br />
            {pileB.map((w, i) => (
              <span key={"b" + i} className="st-ink" style={{ "--i": pileA.length + i } as CSSProperties}>
                {w}{" "}
              </span>
            ))}
          </p>
          <div className="st-pl st-pc" ref={reg("cta")} data-off="">
            <h2 id="cta-h" className="m-0" style={{ font: "inherit" }}>
              <span style={{ "--n": ctaText.length } as CSSProperties} aria-label={ctaText}>
                {wrapLetters(ctaText, "cta")}
              </span>
            </h2>
            <Link to="/rezervasiya" className="st-btn st-btn-accent" data-magnet="" data-cursor="Rezerv et">
              <span>Rezerv et</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ and contact: plain, readable sections */}
      <section className="st-plain" id="faq" aria-labelledby="faq-h">
        <h2 id="faq-h">Tez-tez verilən suallar</h2>
        <div className="st-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 8 · footer */}
      <footer className="st-foot" ref={reg("foot")}>
        <div className="st-fcard">
          <div className="st-frow">
            <nav className="st-flinks" aria-label="Alt menyu">
              <Link to="/park">Avtopark</Link>
              <Link to="/rezervasiya">Rezervasiya</Link>
              <Link to="/hesab">Rezervasiyalarım</Link>
              <Link to="/elaqe">Əlaqə</Link>
            </nav>
            <address className="st-flinks not-italic">
              <span className="inline-flex min-h-11 items-center">Bakı, Xocalı prospekti 13</span>
              <a href="tel:+994503949194">+994 50 394 91 94</a>
              <a href="tel:+994124901164">+994 12 490 11 64</a>
              <a href="mailto:info@afnrentacar.az">info@afnrentacar.az</a>
              <span className="inline-flex min-h-11 items-center">Hər gün 09:00–21:00</span>
            </address>
          </div>
          <div>
            <p className="st-big2" translate="no" aria-label="AFN rent a car">
              AFN
            </p>
            <svg className="st-road" viewBox="0 0 400 18" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength={1} d="M4 9C80 2 140 16 200 9S330 2 396 9" />
            </svg>
          </div>
          <div className="st-frow st-caps">
            <span>© 2026 AFN rent a car · təlim layihəsi, qiymətlər nümunədir</span>
            <a href="https://github.com/codelady-ship/AFN-rent-a-car-fiqma/blob/main/docs/CREDITS.md">Foto və lisenziyalar</a>
          </div>
        </div>
      </footer>

      {/* the kit card in flight between "why AFN" and the kit grid */}
      <div className="st-fly" ref={reg("fly")} aria-hidden="true">
        <span className="st-kit" style={{ "--g1": fly.g[0], "--g2": fly.g[1] } as CSSProperties}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            {fly.icon}
          </svg>
        </span>
      </div>

      <div ref={cursorRef} className="st-cursor" aria-hidden="true">
        <span className="st-cdot" />
        <span ref={labelRef} className="st-clab st-caps" />
      </div>
    </div>
  );
}
