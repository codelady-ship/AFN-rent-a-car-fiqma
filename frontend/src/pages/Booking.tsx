import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EXTRAS, addDays, asset, azn, prettyDay, todayInBaku } from "../lib/shared";
import { useApp, useMeta } from "../lib/store";
import { ApiError, type Booking, type Car, type Location, type Quote } from "../lib/types";

type Errors = Record<string, string>;

export default function BookingPage() {
  useMeta("Onlayn rezervasiya", "Bakıda onlayn avtomobil rezervasiyası: avtomobili, tarixləri, götürmə yerini (ofis, hava limanı, ünvan) və əlavələri seçin – qiymət dərhal hesablanır.");
  const [params] = useSearchParams();
  const { session, draft, setDraft, toggleExtra } = useApp();
  const [cars, setCars] = useState<Car[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState(() => ({
    car: params.get("car") || draft.car || "",
    from: params.get("from") || draft.from || "",
    to: params.get("to") || draft.to || "",
    location: "",
    name: session?.user.role === "customer" ? session.user.name : "",
    phone: session?.user.role === "customer" ? session.user.phone || "" : "",
    email: session?.user.role === "customer" ? session.user.email : "",
    note: "",
  }));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    api.cars({ sort: "price" }).then((c) => setCars(c.filter((x) => x.available)));
    api.locations().then((l) => {
      setLocations(l);
      setForm((f) => (f.location ? f : { ...f, location: l[0]?.id ?? "" }));
    });
  }, []);

  // keep car and dates in the draft so they survive a detour to the login page
  useEffect(() => {
    setDraft((d) => ({ ...d, car: form.car || undefined, from: form.from || undefined, to: form.to || undefined }));
  }, [form.car, form.from, form.to, setDraft]);

  // the price always comes from the server (or the demo engine), debounced
  const quoteKey = useMemo(() => JSON.stringify([form.car, form.from, form.to, form.location, draft.extras]), [form.car, form.from, form.to, form.location, draft.extras]);
  useEffect(() => {
    setQuote(null);
    setQuoteErr("");
    if (!form.car || !form.from || !form.to || !form.location) return;
    let live = true;
    const t = window.setTimeout(() => {
      api
        .quote({ car: form.car, from: form.from, to: form.to, location: form.location, extras: draft.extras })
        .then((q) => live && setQuote(q))
        .catch((e) => live && setQuoteErr(e instanceof ApiError ? e.details[0]?.message || e.message : "Qiymət hesablanmadı"));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.car) e.car = "Avtomobil seçin.";
    if (!form.from) e.from = "Götürmə tarixini seçin.";
    else if (form.from < todayInBaku()) e.from = "Keçmiş tarix seçmək olmaz.";
    if (!form.to) e.to = "Qaytarma tarixini seçin.";
    else if (form.from && form.to <= form.from) e.to = "Qaytarma tarixi götürmə tarixindən sonra olmalıdır.";
    if (form.name.trim().length < 3) e.name = "Ad və soyadı yazın (ən azı 3 hərf).";
    if (!/^[+]?[0-9 ()-]{9,20}$/.test(form.phone.trim())) e.phone = "Telefon nömrəsini düzgün yazın.";
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormErr("");
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      document.getElementById("f-" + Object.keys(e).find((k) => e[k]))?.focus();
      return;
    }
    setSending(true);
    try {
      const token = session?.user.role === "customer" ? session.token : undefined;
      const b = await api.book({ ...form, email: form.email || undefined, extras: draft.extras }, token);
      setDone(b);
      setDraft(() => ({ extras: [] }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.details.length) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
      setFormErr((err as Error).message === "Validation failed" ? "Formada səhvlər var." : (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card p-6" role="status">
          <p className="label-caps m-0 text-brand-dark">Sorğu qəbul olundu</p>
          <h1 className="m-0 mt-1 text-3xl font-bold">Rezervasiya nömrəniz: <span translate="no">{done.reference}</span></h1>
          <p className="mt-3 text-muted">Menecerimiz qısa zamanda {done.phone} nömrəsinə zəng edib rezervasiyanı təsdiqləyəcək.</p>
          <Receipt q={done} carModel={done.carModel} from={done.from} to={done.to} />
          <div className="mt-6 flex flex-wrap gap-3">
            {session?.user.role === "customer" ? (
              <Link to="/hesab" className="btn btn-brand">
                Rezervasiyalarım
              </Link>
            ) : (
              <Link to="/daxil-ol" className="btn btn-brand">
                Hesab yaradın – növbəti dəfə daha tez
              </Link>
            )}
            <Link to="/park" className="btn btn-ghost">
              Avtoparka qayıt
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const car = cars.find((c) => c.id === form.car);
  const err = (k: string) =>
    errors[k] ? (
      <span id={`e-${k}`} className="err">
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: string) => ({ id: `f-${k}`, "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `e-${k}` : undefined });
  const today = todayInBaku();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="m-0 text-3xl font-bold md:text-4xl">Onlayn rezervasiya</h1>
      <p className="mt-2 text-muted">Formu doldurun – menecer rezervasiyanı telefonla təsdiqləyəcək. Ödəniş avtomobili götürəndə edilir.</p>
      {!session && (
        <p className="mt-2 text-sm">
          Rezervasiyalarınızı izləmək üçün <Link to="/daxil-ol?next=/rezervasiya">daxil olun</Link> və ya qonaq kimi davam edin.
        </p>
      )}

      <form className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]" onSubmit={submit} noValidate>
        <div className="grid gap-6">
          <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
            <legend className="px-1 text-lg font-semibold">1. Avtomobil və tarixlər</legend>
            <label className="field sm:col-span-2">
              Avtomobil
              <select className="input" value={form.car} onChange={set("car")} {...aria("car")}>
                <option value="">Avtomobil seçin</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.model} – {c.pricePerDay} AZN/gün ({c.category})
                  </option>
                ))}
              </select>
              {err("car")}
            </label>
            <label className="field">
              Götürmə tarixi
              <input className="input" type="date" min={today} value={form.from} onChange={set("from")} {...aria("from")} />
              {err("from")}
            </label>
            <label className="field">
              Qaytarma tarixi
              <input className="input" type="date" min={form.from ? addDays(form.from, 1) : today} value={form.to} onChange={set("to")} {...aria("to")} />
              {err("to")}
            </label>
          </fieldset>

          <fieldset className="card grid gap-2 p-5">
            <legend className="px-1 text-lg font-semibold">2. Götürmə yeri</legend>
            {locations.map((l) => (
              <label key={l.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2">
                <input type="radio" name="location" value={l.id} checked={form.location === l.id} onChange={set("location")} className="size-5 accent-brand-dark" />
                <span className="flex-1">
                  <span className="font-semibold">{l.name}</span>
                  {l.hours && <span className="block text-sm text-muted">{l.hours}</span>}
                </span>
                <span className="text-sm font-semibold">{l.deliveryFee ? `+${l.deliveryFee} AZN` : "Pulsuz"}</span>
              </label>
            ))}
            {err("location")}
          </fieldset>

          <fieldset className="card grid gap-2 p-5 sm:grid-cols-2">
            <legend className="px-1 text-lg font-semibold">3. Səyahət dəsti (istəyə bağlı)</legend>
            {EXTRAS.map((e) => (
              <label key={e.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2">
                <input type="checkbox" className="mt-1 size-5 accent-brand-dark" checked={draft.extras.includes(e.key)} onChange={() => toggleExtra(e.key)} />
                <span>
                  <span className="font-semibold">{e.name}</span> <span className="text-sm">· {e.pricePerDay} AZN/gün</span>
                  <span className="block text-sm text-muted">{e.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
            <legend className="px-1 text-lg font-semibold">4. Əlaqə məlumatları</legend>
            <label className="field">
              Ad və soyad
              <input className="input" autoComplete="name" value={form.name} onChange={set("name")} {...aria("name")} />
              {err("name")}
            </label>
            <label className="field">
              Telefon
              <input className="input" type="tel" autoComplete="tel" placeholder="+994 50 000 00 00" value={form.phone} onChange={set("phone")} {...aria("phone")} />
              {err("phone")}
            </label>
            <label className="field sm:col-span-2">
              E-poçt (istəyə bağlı)
              <input className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} {...aria("email")} />
              {err("email")}
            </label>
            <label className="field sm:col-span-2">
              Qeyd (istəyə bağlı)
              <textarea className="input" rows={3} maxLength={500} value={form.note} onChange={set("note")} />
            </label>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-labelledby="sum-h">
          <div className="card p-5">
            <h2 id="sum-h" className="m-0 text-xl font-bold">
              Xülasə
            </h2>
            {car && <img src={asset(car.image)} alt={car.model} width={700} height={467} className="mt-3 aspect-[3/2] w-full object-contain" />}
            {quote ? (
              <Receipt q={quote} carModel={car?.model ?? ""} from={form.from} to={form.to} />
            ) : (
              <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">
                {quoteErr || "Avtomobil və tarixləri seçin – qiymət burada görünəcək."}
              </p>
            )}
            {formErr && (
              <p className="err mt-3" role="alert">
                {formErr}
              </p>
            )}
            <button className="btn btn-brand mt-4 w-full" disabled={sending}>
              {sending ? "Göndərilir…" : "Rezervasiya sorğusu göndər"}
            </button>
            <p className="mt-2 text-xs text-muted">Qiymət serverdə hesablanır; ödəniş avtomobil təhvil veriləndə edilir.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Receipt({ q, carModel, from, to }: { q: Quote; carModel: string; from: string; to: string }) {
  return (
    <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted">Avtomobil</dt>
      <dd className="m-0 text-right font-semibold" translate="no">{carModel}</dd>
      <dt className="text-muted">Tarixlər</dt>
      <dd className="m-0 text-right">
        {prettyDay(from)} → {prettyDay(to)}
      </dd>
      <dt className="text-muted">Yer</dt>
      <dd className="m-0 text-right">{q.place}</dd>
      <dt className="text-muted">
        {q.days} gün × {q.pricePerDay} AZN
      </dt>
      <dd className="m-0 text-right">{azn(q.carTotal)}</dd>
      {q.extras.map((e) => (
        <div key={e.key} className="contents">
          <dt className="text-muted">{e.name}</dt>
          <dd className="m-0 text-right">{azn(e.total)}</dd>
        </div>
      ))}
      {q.deliveryFee > 0 && (
        <>
          <dt className="text-muted">Çatdırılma</dt>
          <dd className="m-0 text-right">{azn(q.deliveryFee)}</dd>
        </>
      )}
      <dt className="mt-2 border-t border-line pt-2 text-base font-bold">Cəmi</dt>
      <dd className="m-0 mt-2 border-t border-line pt-2 text-right text-base font-bold text-brand-dark">{azn(q.total)}</dd>
    </dl>
  );
}
