import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EXTRAS, asset, prettyDay } from "../lib/shared";
import { useApp, useMeta } from "../lib/store";
import { ApiError, type Car, type Review } from "../lib/types";

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} / 5`} className="text-brand-dark">
    {"★".repeat(Math.round(n))}
    <span className="text-line">{"★".repeat(5 - Math.round(n))}</span>
  </span>
);

export default function CarDetail() {
  const { id = "" } = useParams();
  const [search] = useSearchParams();
  const { session, draft, toggleExtra, say } = useApp();
  const [car, setCar] = useState<Car | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  useMeta(car ? `${car.model} icarəsi – ${car.pricePerDay} AZN/gün` : "Avtomobil", car ? `${car.model} (${car.year}) icarəsi Bakıda: ${car.seats} yer, ${car.transmission}, ${car.fuelType}. Gündəlik ${car.pricePerDay} AZN, onlayn rezervasiya, hava limanına və ünvana çatdırılma – AFN rent a car.` : undefined);

  useEffect(() => {
    let live = true;
    Promise.all([api.car(id), api.reviews(id), api.busy(id)])
      .then(([c, r, b]) => {
        if (!live) return;
        setCar(c);
        setReviews(r);
        setBusy(b);
      })
      .catch((e) => live && setError(e instanceof ApiError && e.status === 404 ? "Avtomobil tapılmadı." : e.message));
    return () => {
      live = false;
    };
  }, [id]);

  const sendReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setReviewMsg("");
    try {
      const r = await api.addReview(session.token, id, rating, comment);
      setReviews((list) => [r, ...list]);
      setComment("");
      say("Rəyiniz üçün təşəkkür edirik");
    } catch (err) {
      setReviewMsg((err as Error).message);
    }
  };

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{error}</h1>
        <Link to="/park" className="btn btn-brand mt-4">
          Avtoparka qayıt
        </Link>
      </div>
    );
  if (!car) return <p className="py-24 text-center text-muted" role="status">Yüklənir…</p>;

  const bookHref = `/rezervasiya?car=${car.id}${search.get("from") ? `&from=${search.get("from")}&to=${search.get("to") ?? ""}` : ""}`;
  const specs: [string, string][] = [
    ["Klass", car.category],
    ["Buraxılış ili", String(car.year)],
    ["Yer sayı", String(car.seats)],
    ["Sürətlər qutusu", car.transmission],
    ["Yanacaq", car.fuelType],
    ["Mühərrik", car.engine + " L"],
    ...(car.color ? ([["Rəng", car.color]] as [string, string][]) : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Naviqasiya zənciri" className="text-sm text-muted">
        <Link to="/park" className="inline-flex min-h-11 items-center text-inherit">
          Avtopark
        </Link>{" "}
        / <span translate="no">{car.model}</span>
      </nav>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="card overflow-hidden">
          <img src={asset(car.image)} alt={`${car.model}, ${car.year}, ${car.color || ""}`.replace(/, $/, "")} width={700} height={467} className="aspect-[3/2] w-full object-contain p-4" />
        </div>
        <div>
          <p className="label-caps m-0 text-brand-dark">{car.category}</p>
          <h1 className="m-0 mt-1 text-3xl font-bold md:text-4xl" translate="no">
            {car.model}
          </h1>
          {car.rating && car.rating.count > 0 && (
            <p className="mt-2 text-sm">
              <Stars n={car.rating.average} /> {car.rating.average} · {car.rating.count} rəy
            </p>
          )}
          <p className="mt-3 text-muted">{car.description}</p>
          <p className="mt-4 text-3xl font-bold text-brand-dark">
            {car.pricePerDay} AZN<span className="text-base font-medium text-muted"> / gün</span>
          </p>
          {car.available ? (
            <Link to={bookHref} className="btn btn-brand mt-4 w-full sm:w-auto">
              Bu avtomobili rezerv et
            </Link>
          ) : (
            <p className="mt-4 rounded-lg bg-paper p-3 text-sm">Bu avtomobil hazırda icarədədir. Oxşar avtomobillərə <Link to={`/park?category=${encodeURIComponent(car.category)}`}>buradan</Link> baxın.</p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="border-b border-line pb-2">
                <dt className="text-muted">{k}</dt>
                <dd className="m-0 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="kit-h">
        <h2 id="kit-h" className="text-2xl font-bold">
          Səyahət dəstiniz
        </h2>
        <p className="text-muted">Əlavələri seçin – rezervasiya formasında qiymətə əlavə olunacaq.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTRAS.map((e) => {
            const on = draft.extras.includes(e.key);
            return (
              <button
                key={e.key}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => say(toggleExtra(e.key) ? `${e.name} əlavə olundu` : `${e.name} çıxarıldı`)}
              >
                {on ? "✓ " : "+ "}
                {e.name} · {e.pricePerDay} AZN/gün
              </button>
            );
          })}
        </div>
      </section>

      {busy.length > 0 && (
        <section className="mt-10" aria-labelledby="busy-h">
          <h2 id="busy-h" className="text-2xl font-bold">
            Məşğul günlər
          </h2>
          <p className="text-muted">Bu günlərdə avtomobil artıq rezerv olunub:</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
            {busy.slice(0, 40).map((d) => (
              <li key={d} className="rounded-md bg-paper px-2 py-1">
                {prettyDay(d)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="rev-h">
        <h2 id="rev-h" className="text-2xl font-bold">
          Müştəri rəyləri
        </h2>
        {reviews.length === 0 && <p className="text-muted">Hələ rəy yoxdur.</p>}
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <p className="m-0 font-semibold">
                {r.authorName} <Stars n={r.rating} />
              </p>
              {r.comment && <p className="m-0 mt-1 text-muted">{r.comment}</p>}
            </li>
          ))}
        </ul>
        {session?.user.role === "customer" ? (
          <form className="card mt-4 grid max-w-xl gap-3 p-4" onSubmit={sendReview}>
            <h3 className="m-0 text-lg font-semibold">Rəy yazın</h3>
            <p className="m-0 text-sm text-muted">Rəyi bu avtomobili icarəyə götürüb qaytaran müştərilər yaza bilər.</p>
            <label className="field">
              Qiymət
              <select className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ulduz
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Şərh
              <textarea className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            {reviewMsg && <p className="err m-0" role="alert">{reviewMsg}</p>}
            <button className="btn btn-brand justify-self-start">Göndər</button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Rəy yazmaq üçün <Link to={`/daxil-ol?next=/park/${car.id}`}>daxil olun</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
