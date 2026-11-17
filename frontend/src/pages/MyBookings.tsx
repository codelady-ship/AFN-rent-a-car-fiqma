import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { STATUS_LABEL, azn, prettyDay, todayInBaku } from "../lib/shared";
import { useApp, useMeta } from "../lib/store";
import { ApiError, type Booking } from "../lib/types";

export const StatusBadge = ({ s }: { s: string }) => {
  const cls: Record<string, string> = {
    pending: "bg-[#fff3e0] text-[#8a4b00]",
    confirmed: "bg-[#e6f4ea] text-[#1e6b34]",
    completed: "bg-paper text-ink",
    cancelled: "bg-[#fdecea] text-[#9b1c1c]",
  };
  return <span className={"label-caps rounded-md px-2 py-1 " + (cls[s] ?? "")}>{STATUS_LABEL[s] ?? s}</span>;
};

export default function MyBookings() {
  useMeta("Rezervasiyalarım", undefined, { noindex: true });
  const { session, setSession, say } = useApp();
  const [list, setList] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!session) return;
    api
      .mine(session.token)
      .then(setList)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setSession(null);
        setError(e.message);
      });
  }, [session, setSession]);
  useEffect(load, [load]);

  if (!session) return <Navigate to="/daxil-ol?next=/hesab" replace />;
  if (session.user.role === "admin") return <Navigate to="/admin" replace />;

  const cancel = async (b: Booking) => {
    if (!window.confirm(`${b.reference} rezervasiyasını ləğv edək?`)) return;
    try {
      await api.cancel(session.token, b.id);
      say("Rezervasiya ləğv edildi");
      load();
    } catch (e) {
      say((e as Error).message);
    }
  };
  const today = todayInBaku();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="m-0 text-3xl font-bold">Rezervasiyalarım</h1>
      <p className="mt-2 text-muted">Salam, {session.user.name}. Burada yalnız sizin rezervasiyalarınız görünür.</p>
      {error && <p className="err">{error}</p>}
      {list && list.length === 0 && (
        <p className="mt-6">
          Hələ rezervasiya yoxdur. <Link to="/park">Avtoparka baxın</Link>.
        </p>
      )}
      <ul className="m-0 mt-6 grid list-none gap-4 p-0">
        {list?.map((b) => (
          <li key={b.id} className="card grid gap-2 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="m-0 flex flex-wrap items-center gap-2">
                <strong translate="no">{b.reference}</strong> <StatusBadge s={b.status} />
              </p>
              <p className="m-0 mt-1 text-lg font-semibold" translate="no">
                {b.carModel}
              </p>
              <p className="m-0 text-sm text-muted">
                {prettyDay(b.from)} → {prettyDay(b.to)} · {b.days} gün · {b.place}
              </p>
              {b.extras.length > 0 && <p className="m-0 text-sm text-muted">Əlavələr: {b.extras.map((e) => e.name).join(", ")}</p>}
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <span className="text-xl font-bold text-brand-dark">{azn(b.total)}</span>
              {(b.status === "pending" || b.status === "confirmed") && b.from > today && (
                <button type="button" className="btn btn-ghost" onClick={() => cancel(b)}>
                  Ləğv et
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
