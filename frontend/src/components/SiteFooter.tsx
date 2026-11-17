import { Link } from "react-router-dom";
import { asset } from "../lib/shared";

/** Contact details shown on every page (they match the AutoRental JSON-LD in index.html). */
export function ContactList({ className = "" }: { className?: string }) {
  return (
    <ul className={"m-0 grid list-none gap-1 p-0 " + className}>
      <li>Bakı, Xocalı prospekti 13</li>
      <li>
        <a className="text-inherit underline-offset-4 hover:underline" href="tel:+994503949194">
          +994 50 394 91 94
        </a>
      </li>
      <li>
        <a className="text-inherit underline-offset-4 hover:underline" href="tel:+994124901164">
          +994 12 490 11 64
        </a>
      </li>
      <li>
        <a className="text-inherit underline-offset-4 hover:underline" href="mailto:info@afnrentacar.az">
          info@afnrentacar.az
        </a>
      </li>
      <li>Hər gün 09:00–21:00</li>
    </ul>
  );
}

export default function SiteFooter() {
  return (
    <footer className="bg-ink px-4 pb-6 pt-12 text-[#ddd]">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <img src={asset("fotos/logo-white.png")} alt="AFN rent a car" width={150} height={42} className="h-10 w-auto" translate="no" loading="lazy" />
          <p className="mt-3 text-sm">Bakıda avtomobil, mikroavtobus və avtobus kirayəsi.</p>
        </div>
        <div>
          <h2 className="mb-2 text-base font-semibold text-white">Əlaqə</h2>
          <ContactList className="text-sm" />
        </div>
        <div>
          <h2 className="mb-2 text-base font-semibold text-white">Bölmələr</h2>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            <li><Link className="text-inherit hover:text-[#ffb38f]" to="/park">Avtopark</Link></li>
            <li><Link className="text-inherit hover:text-[#ffb38f]" to="/rezervasiya">Onlayn rezervasiya</Link></li>
            <li><Link className="text-inherit hover:text-[#ffb38f]" to="/hesab">Rezervasiyalarım</Link></li>
            <li><Link className="text-inherit hover:text-[#ffb38f]" to="/elaqe">Əlaqə</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-base font-semibold text-white">Layihə</h2>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            <li>
              <a className="text-inherit hover:text-[#ffb38f]" href="https://github.com/codelady-ship/AFN-rent-a-car-fiqma" translate="no">
                GitHub
              </a>
            </li>
            <li>
              <a className="text-inherit hover:text-[#ffb38f]" href="https://github.com/codelady-ship/AFN-rent-a-car-fiqma/blob/main/docs/CREDITS.md">
                Foto və lisenziyalar
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-[#3a3a3a] pt-4 text-xs text-[#bbb]">
        © 2026 AFN rent a car · Figma dizaynı əsasında təlim layihəsi; qiymətlər və avtopark nümunədir.
      </p>
    </footer>
  );
}
