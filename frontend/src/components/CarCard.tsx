import { Link } from "react-router-dom";
import type { Car } from "../lib/types";
import { asset } from "../lib/shared";

export default function CarCard({ car, search = "" }: { car: Car; search?: string }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="relative bg-white">
        <img
          src={asset(car.image)}
          alt={`${car.model}, ${car.year}`}
          width={700}
          height={467}
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full object-contain p-2"
        />
        <span className="label-caps absolute right-3 top-3 rounded-md bg-brand-dark px-2 py-1 text-white">{car.category}</span>
        {!car.available && <span className="label-caps absolute left-3 top-3 rounded-md bg-ink px-2 py-1 text-white">İcarədədir</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-4">
        <h3 className="m-0 text-lg font-semibold" translate="no">
          {car.model}
        </h3>
        <p className="m-0 text-sm text-muted">Buraxılış ili: {car.year}</p>
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-sm text-muted" aria-label="Xüsusiyyətlər">
          <li>{car.seats} yer</li>
          <li>{car.transmission}</li>
          <li>{car.fuelType}</li>
          <li>{car.engine} L</li>
        </ul>
        <p className="m-0 mt-auto text-xl font-bold text-brand-dark">
          {car.pricePerDay} AZN<span className="text-sm font-medium text-muted">/gün</span>
        </p>
        <Link to={`/park/${car.id}${search}`} className="btn btn-ghost mt-1" aria-label={`${car.model} – ətraflı və rezervasiya`}>
          Ətraflı və rezerv et
        </Link>
      </div>
    </article>
  );
}
