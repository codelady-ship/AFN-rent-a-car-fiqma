import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { CATEGORIES, STATUS_LABEL, TRANSITIONS, azn, prettyDay } from "../lib/shared";
import { useApp, useMeta } from "../lib/store";
import { demo as sandbox } from "../lib/demo";
import { ApiError, canAdmin, type Booking, type Car, type Message, type Stats } from "../lib/types";
import { StatusBadge } from "./MyBookings";

type Tab = "panel" | "bookings" | "cars" | "messages";
const TABS: [Tab, string][] = [
  ["panel", "Panel"],
  ["bookings", "Rezervasiyalar"],
  ["cars", "Avtomobillər"],
  ["messages", "Mesajlar"],
];

const CONFIRM_MS = 6000;

/**
 * Two-step delete inside the page. The portfolio shows this admin in a sandboxed iframe without
 * allow-modals, where window.confirm() / alert() / prompt() are ignored and return at once, so no
 * native dialog may be used here. "Sil" turns into "Əminsən? Sil / Ləğv et" for a few seconds;
 * Escape or "Ləğv et" backs out, and focus follows the buttons so it works from the keyboard.
 */
function ConfirmDelete({ what, onConfirm }: { what: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  // Asked from the keyboard or by click: move focus to the button that replaced the one in use.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (armed ? yes : first).current?.focus();
  }, [armed]);
  // Not answered: go back to "Sil" quietly (focus only moves if it was on the question).
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => {
      moveFocus.current = !!yes.current?.parentElement?.contains(document.activeElement);
      setArmed(false);
    }, CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  const set = (next: boolean) => {
    moveFocus.current = true;
    setArmed(next);
  };

  if (!armed)
    return (
      <button ref={first} type="button" className="btn btn-ghost" aria-label={`${what}: sil`} onClick={() => set(true)}>
        Sil
      </button>
    );
  return (
    <span
      role="group"
      aria-label={`${what}: silmək təsdiqi`}
      className="inline-flex flex-wrap items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          set(false);
        }
      }}
    >
      <span className="font-semibold" role="status">
        Əminsən?
      </span>
      <button
        ref={yes}
        type="button"
        className="btn btn-dark"
        aria-label={`${what}: bəli, sil`}
        onClick={() => {
          set(false);
          onConfirm();
        }}
      >
        Sil
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => set(false)}>
        Ləğv et
      </button>
    </span>
  );
}

export default function Admin() {
  useMeta("Admin panel", undefined, { noindex: true });
  const { session, setSession, say, demo } = useApp();
  const [tab, setTab] = useState<Tab>("panel");
  const [stats, setStats] = useState<Stats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState("");
  const [cars, setCars] = useState<Car[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editing, setEditing] = useState<Partial<Car> | null>(null);
  const token = canAdmin(session?.user) ? session!.token : "";
  const readOnly = session?.user.role === "demo";

  const fail = useCallback(
    (e: unknown) => {
      // The read-only demo admin gets 403 for every write: show the message, keep the session.
      if (e instanceof ApiError && (e.status === 401 || (e.status === 403 && !readOnly))) setSession(null);
      say((e as Error).message);
    },
    [say, setSession, readOnly]
  );
  const refresh = useCallback(() => {
    if (!token) return;
    api.admin.stats(token).then(setStats).catch(fail);
    api.admin.bookings(token, filter || undefined).then(setBookings).catch(fail);
    api.cars().then(setCars).catch(fail);
    api.admin.messages(token).then(setMessages).catch(fail);
  }, [token, filter, fail]);
  useEffect(refresh, [refresh]);

  if (!session) return <Navigate to="/daxil-ol?next=/admin" replace />;
  if (!canAdmin(session.user))
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Bu səhifə yalnız admin üçündür</h1>
      </div>
    );

  const changeStatus = async (b: Booking, status: Booking["status"]) => {
    try {
      await api.admin.setStatus(token, b.id, status);
      say(`${b.reference}: ${STATUS_LABEL[status]}`);
      refresh();
    } catch (e) {
      fail(e);
    }
  };
  const saveCar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.admin.saveCar(token, {
        ...editing,
        year: Number(editing.year),
        seats: Number(editing.seats),
        pricePerDay: Number(editing.pricePerDay),
      });
      say("Avtomobil yadda saxlanıldı");
      setEditing(null);
      refresh();
    } catch (err) {
      const d = err instanceof ApiError ? err.details.map((x) => `${x.field}: ${x.message}`).join("; ") : "";
      say(d || (err as Error).message);
    }
  };
  // Confirmation happens in the page (ConfirmDelete below), never with window.confirm().
  const removeCar = async (c: Car) => {
    try {
      await api.admin.deleteCar(token, c.id);
      say("Silindi");
      refresh();
    } catch (e) {
      fail(e);
    }
  };
  const setMsg = async (m: Message, status: Message["status"]) => {
    try {
      await api.admin.setMessage(token, m.id, status);
      refresh();
    } catch (e) {
      fail(e);
    }
  };
  const delMsg = async (m: Message) => {
    try {
      await api.admin.deleteMessage(token, m.id);
      say("Mesaj silindi");
      refresh();
    } catch (e) {
      fail(e);
    }
  };

  const input = (k: keyof Car, label: string, type = "text") => (
    <label className="field">
      {label}
      <input
        className="input"
        type={type}
        required={k !== "color" && k !== "description"}
        value={(editing?.[k] as string | number | undefined) ?? ""}
        onChange={(e) => setEditing((c) => ({ ...c, [k]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="m-0 text-3xl font-bold">Admin panel</h1>
      {(demo || readOnly) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-3 text-sm" role="note">
          <p className="m-0 flex-1 basis-60">
            <strong className="text-ink">Demo rejim</strong> — dəyişikliklər saxlanılmır.{" "}
            {demo ? "Məlumat nümunədir və yalnız bu brauzerdə dəyişir." : "Demo admin yalnız baxa bilər; müştəri məlumatları gizlədilib."}
          </p>
          {demo && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                sandbox.reset();
                say("Demo məlumatları sıfırlandı");
                refresh();
              }}
            >
              Sıfırla
            </button>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Bölmələr">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {label}
            {k === "messages" && stats?.newMessages ? ` (${stats.newMessages})` : ""}
          </button>
        ))}
      </div>

      {tab === "panel" && stats && (
        <section id="panel-panel" role="tabpanel" aria-labelledby="tab-panel" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Gözləyən rezervasiya", stats.bookings.pending],
            ["Təsdiqlənmiş", stats.bookings.confirmed],
            ["Başa çatmış", stats.bookings.completed],
            ["Ləğv edilmiş", stats.bookings.cancelled],
            ["Gəlir (təsdiqlənmiş + bitmiş)", azn(stats.revenue)],
            ["Avtomobil", stats.cars],
            ["Müştəri", stats.customers],
            ["Yeni mesaj", stats.newMessages],
          ].map(([k, v]) => (
            <div key={k as string} className="card p-4">
              <p className="m-0 text-sm text-muted">{k}</p>
              <p className="m-0 mt-1 text-2xl font-bold">{v}</p>
            </div>
          ))}
        </section>
      )}

      {tab === "bookings" && (
        <section id="panel-bookings" role="tabpanel" aria-labelledby="tab-bookings" className="mt-6">
          <label className="field max-w-xs">
            Status
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Hamısı</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {bookings.length === 0 && <p className="mt-4 text-muted">Rezervasiya yoxdur.</p>}
          <ul className="m-0 mt-4 grid list-none gap-3 p-0">
            {bookings.map((b) => (
              <li key={b.id} className="card grid gap-2 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="m-0 flex flex-wrap items-center gap-2">
                    <strong translate="no">{b.reference}</strong> <StatusBadge s={b.status} />
                    <span className="font-semibold" translate="no">{b.carModel}</span>
                  </p>
                  <p className="m-0 text-sm text-muted">
                    {prettyDay(b.from)} → {prettyDay(b.to)} · {b.days} gün · {b.place} · <strong className="text-ink">{azn(b.total)}</strong>
                  </p>
                  <p className="m-0 text-sm">
                    {b.name} · <a href={`tel:${b.phone.replace(/[^+0-9]/g, "")}`}>{b.phone}</a>
                    {b.email ? ` · ${b.email}` : ""}
                  </p>
                  {b.note && <p className="m-0 text-sm text-muted">“{b.note}”</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {TRANSITIONS[b.status].map((s) => (
                    <button key={s} type="button" className={s === "cancelled" ? "btn btn-ghost" : "btn btn-brand"} onClick={() => changeStatus(b, s)}>
                      {s === "confirmed" ? "Təsdiqlə" : s === "completed" ? "Bitdi" : "Ləğv et"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "cars" && (
        <section id="panel-cars" role="tabpanel" aria-labelledby="tab-cars" className="mt-6">
          <button
            type="button"
            className="btn btn-brand"
            onClick={() => setEditing({ category: "Ekonom", transmission: "Avtomatik", fuelType: "Benzin", available: true, image: "/fotos/cars/" })}
          >
            + Yeni avtomobil
          </button>
          {editing && (
            <form className="card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveCar} aria-label="Avtomobil forması">
              {input("model", "Model")}
              {input("brand", "Marka")}
              {input("year", "İl", "number")}
              <label className="field">
                Klass
                <select className="input" value={editing.category} onChange={(e) => setEditing((c) => ({ ...c, category: e.target.value }))}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {input("transmission", "Sürətlər qutusu")}
              {input("fuelType", "Yanacaq")}
              {input("engine", "Mühərrik (L)")}
              {input("seats", "Yer sayı", "number")}
              {input("pricePerDay", "Qiymət (AZN/gün)", "number")}
              {input("color", "Rəng")}
              {input("image", "Şəkil yolu")}
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" className="size-5 accent-brand-dark" checked={!!editing.available} onChange={(e) => setEditing((c) => ({ ...c, available: e.target.checked }))} />
                Mövcuddur
              </label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <button className="btn btn-brand">Yadda saxla</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                  Bağla
                </button>
              </div>
            </form>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Avtomobillər</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Klass</th>
                  <th className="py-2 pr-3">Qiymət</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((c) => (
                  <tr key={c.id} className="border-b border-line">
                    <td className="py-2 pr-3 font-semibold" translate="no">{c.model}</td>
                    <td className="py-2 pr-3">{c.category}</td>
                    <td className="py-2 pr-3">{c.pricePerDay} AZN</td>
                    <td className="py-2 pr-3">{c.available ? "Mövcud" : "İcarədə"}</td>
                    <td className="flex gap-2 py-2">
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(c)}>
                        Redaktə
                      </button>
                      <ConfirmDelete what={c.model} onConfirm={() => removeCar(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "messages" && (
        <section id="panel-messages" role="tabpanel" aria-labelledby="tab-messages" className="mt-6">
          {messages.length === 0 && <p className="text-muted">Mesaj yoxdur.</p>}
          <ul className="m-0 grid list-none gap-3 p-0">
            {messages.map((m) => (
              <li key={m.id} className="card p-4">
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <strong>{m.name}</strong> <a href={`mailto:${m.email}`}>{m.email}</a> {m.phone && <span>{m.phone}</span>}
                  <span className="label-caps rounded-md bg-paper px-2 py-1">{m.status === "new" ? "Yeni" : m.status === "read" ? "Oxunub" : "Arxiv"}</span>
                </p>
                {m.subject && <p className="m-0 mt-1 font-semibold">{m.subject}</p>}
                <p className="m-0 mt-1 whitespace-pre-line text-muted">{m.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.status !== "read" && (
                    <button type="button" className="btn btn-ghost" onClick={() => setMsg(m, "read")}>
                      Oxundu
                    </button>
                  )}
                  {m.status !== "archived" && (
                    <button type="button" className="btn btn-ghost" onClick={() => setMsg(m, "archived")}>
                      Arxivlə
                    </button>
                  )}
                  <ConfirmDelete what={`${m.name} mesajı`} onConfirm={() => delMsg(m)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
