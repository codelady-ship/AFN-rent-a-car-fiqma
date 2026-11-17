import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CarCard from "../components/CarCard";
import { api } from "../lib/api";
import { CATEGORIES, addDays, todayInBaku } from "../lib/shared";
import { useMeta } from "../lib/store";
import type { Car, CarFilters } from "../lib/types";

const num = (v: string | null) => (v ? Number(v) : undefined);

export default function Fleet() {
  useMeta("Avtopark – icarəyə avtomobillər", "AFN avtoparkı: ekonom, biznes, premium, SUV və avtobuslar. Klass, qiymət, yer sayı, sürətlər qutusu və tarixə görə filtr.");
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState<Car[] | null>(null);
  const [error, setError] = useState("");

  const filters: CarFilters = useMemo(
    () => ({
      category: params.get("category") || undefined,
      maxPrice: num(params.get("maxPrice")),
      seats: num(params.get("seats")),
      transmission: params.get("transmission") || undefined,
      fuel: params.get("fuel") || undefined,
      q: params.get("q") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      sort: params.get("sort") || undefined,
    }),
    [params]
  );
  const datesOk = !filters.from || !filters.to || filters.from < filters.to;

  useEffect(() => {
    let live = true;
    setCars(null);
    setError("");
    const f = { ...filters };
    if (!f.from || !f.to || !datesOk) {
      delete f.from;
      delete f.to;
    }
    api
      .cars(f)
      .then((c) => live && setCars(c))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [filters, datesOk]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const today = todayInBaku();
  const dateSearch = filters.from && filters.to && datesOk ? `?from=${filters.from}&to=${filters.to}` : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="m-0 text-3xl font-bold md:text-4xl">Avtopark</h1>
      <p className="mt-2 max-w-2xl text-muted">Klassı, büdcəni və tarixləri seçin – yalnız həmin günlərdə boş olan avtomobillər göstəriləcək.</p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Klass">
        {["Hamısı", ...CATEGORIES].map((c) => {
          const on = (filters.category || "Hamısı") === c;
          return (
            <button key={c} type="button" className="chip" aria-pressed={on} onClick={() => set("category", c === "Hamısı" ? "" : c)}>
              {c}
            </button>
          );
        })}
      </div>

      <form className="card mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()} aria-label="Filtrlər">
        <label className="field">
          Axtarış
          <input className="input" type="search" placeholder="Marka və ya model" defaultValue={filters.q} onChange={(e) => set("q", e.target.value.trim())} />
        </label>
        <label className="field">
          Gündəlik qiymət (ən çox)
          <select className="input" value={filters.maxPrice ?? ""} onChange={(e) => set("maxPrice", e.target.value)}>
            <option value="">İstənilən</option>
            {[50, 80, 100, 150, 200, 400].map((p) => (
              <option key={p} value={p}>
                {p} AZN-ə qədər
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Yer sayı (ən azı)
          <select className="input" value={filters.seats ?? ""} onChange={(e) => set("seats", e.target.value)}>
            <option value="">İstənilən</option>
            {[2, 4, 5, 7, 20].map((s) => (
              <option key={s} value={s}>
                {s}+ yer
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sürətlər qutusu
          <select className="input" value={filters.transmission ?? ""} onChange={(e) => set("transmission", e.target.value)}>
            <option value="">İstənilən</option>
            <option value="Avtomatik">Avtomatik</option>
            <option value="Mexaniki">Mexaniki</option>
          </select>
        </label>
        <label className="field">
          Yanacaq
          <select className="input" value={filters.fuel ?? ""} onChange={(e) => set("fuel", e.target.value)}>
            <option value="">İstənilən</option>
            {["Benzin", "Dizel", "Hibrid", "Elektrik"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Götürmə tarixi
          <input className="input" type="date" min={today} value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="field">
          Qaytarma tarixi
          <input
            className="input"
            type="date"
            min={filters.from ? addDays(filters.from, 1) : today}
            value={filters.to ?? ""}
            aria-invalid={!datesOk}
            aria-describedby={!datesOk ? "dates-err" : undefined}
            onChange={(e) => set("to", e.target.value)}
          />
          {!datesOk && (
            <span id="dates-err" className="err">
              Qaytarma tarixi götürmə tarixindən sonra olmalıdır.
            </span>
          )}
        </label>
        <label className="field">
          Sıralama
          <select className="input" value={filters.sort ?? ""} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Tövsiyə olunan</option>
            <option value="price">Əvvəl ucuz</option>
            <option value="-price">Əvvəl bahalı</option>
            <option value="-year">Əvvəl yeni</option>
          </select>
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted" role="status" aria-live="polite">
          {cars ? `${cars.length} avtomobil tapıldı` : error ? "" : "Yüklənir…"}
        </p>
        {params.toString() && (
          <button type="button" className="btn btn-ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Filtrləri sıfırla
          </button>
        )}
      </div>

      {error && <p className="err mt-4">{error}</p>}
      {cars && cars.length === 0 && <p className="mt-8 text-center text-muted">Bu şərtlərə uyğun avtomobil yoxdur. Filtrləri dəyişin.</p>}
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cars?.map((c) => <CarCard key={c.id} car={c} search={dateSearch} />)}
      </div>
    </div>
  );
}
