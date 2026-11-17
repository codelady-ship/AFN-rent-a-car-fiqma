import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isDemo, onModeChange } from "./api";
import type { Session } from "./types";

/* ---------- small localStorage helpers (never throw: private mode, blocked storage) ---------- */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/** The booking being put together: car and trip-kit extras picked on the landing page or a car page. */
export type Draft = { car?: string; extras: string[]; from?: string; to?: string };

type Ctx = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  toggleExtra: (key: string) => boolean;
  say: (text: string) => void;
  demo: boolean;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => storage.get<Session | null>("afn-session", null));
  const [draft, setDraftState] = useState<Draft>(() => storage.get<Draft>("afn-draft", { extras: [] }));
  const [toast, setToast] = useState({ text: "", on: false });
  const [demo, setDemo] = useState(isDemo());
  const timer = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => onModeChange(() => setDemo(isDemo())), []);

  const setSession = useCallback((s: Session | null) => {
    storage.set("afn-session", s);
    setSessionState(s);
  }, []);
  const setDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraftState((d) => {
      const next = fn(d);
      storage.set("afn-draft", next);
      return next;
    });
  }, []);
  const toggleExtra = useCallback(
    (key: string) => {
      const on = !draftRef.current.extras.includes(key);
      setDraft((d) => ({ ...d, extras: on ? [...d.extras, key] : d.extras.filter((k) => k !== key) }));
      return on;
    },
    [setDraft]
  );
  const say = useCallback((text: string) => {
    setToast({ text, on: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast((t) => ({ ...t, on: false })), 2800);
  }, []);

  const value = useMemo(() => ({ session, setSession, draft, setDraft, toggleExtra, say, demo }), [session, setSession, draft, setDraft, toggleExtra, say, demo]);
  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="afn-toast" role="status" aria-live="polite" data-on={toast.on ? "" : undefined}>
        {toast.text}
      </div>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

/** Sets a <meta> in <head>, creating it when index.html does not have it. */
function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets the page title, description, canonical link, Open Graph/Twitter tags and robots for the current route.
 * noindex: private or utility routes (sign-in, my bookings, admin, 404) stay out of search results.
 */
export function useMeta(title: string, description?: string, { noindex = false }: { noindex?: boolean } = {}) {
  useEffect(() => {
    document.title = title.includes("AFN") ? title : `${title} | AFN rent a car`;
    const site = (import.meta.env.VITE_SITE_URL || location.origin).replace(/\/$/, "");
    const path = location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "") || "/";
    const url = site + path;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    setMeta("property", "og:title", document.title);
    setMeta("name", "twitter:title", document.title);
    setMeta("property", "og:url", url);
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
  }, [title, description, noindex]);
}
