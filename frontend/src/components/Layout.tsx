import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { asset } from "../lib/shared";
import { useApp } from "../lib/store";
import { canAdmin } from "../lib/types";
import SiteFooter from "./SiteFooter";

export function DemoBanner() {
  const { demo } = useApp();
  if (!demo) return null;
  return (
    <p className="bg-paper px-4 py-2 text-center text-sm text-muted">
      <strong className="text-ink">Demo rejim:</strong> API qoşulmayıb, avtomobillər nümunə məlumatdır və rezervasiyalar yalnız bu brauzerdə saxlanılır.
    </p>
  );
}

export function Logo({ white = false }: { white?: boolean }) {
  return <img src={asset(white ? "fotos/logo-white.png" : "fotos/logo.png")} alt="AFN rent a car" width={150} height={42} className="h-10 w-auto" translate="no" />;
}

const links = [
  { to: "/park", label: "Avtopark" },
  { to: "/rezervasiya", label: "Rezervasiya" },
  { to: "/elaqe", label: "Əlaqə" },
];

export default function Layout() {
  const { session, setSession } = useApp();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navCls = ({ isActive }: { isActive: boolean }) =>
    "flex min-h-11 items-center rounded-lg px-3 font-semibold no-underline " + (isActive ? "text-brand-dark" : "text-ink hover:text-brand-dark");

  return (
    <>
      <a className="skip-link" href="#main">
        Əsas məzmuna keç
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link to="/" aria-label="AFN rent a car – ana səhifə" className="flex min-h-11 shrink-0 items-center">
            <Logo />
          </Link>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menyu
          </button>
          <nav
            id="site-nav"
            aria-label="Əsas menyu"
            className={(open ? "flex" : "hidden") + " absolute left-0 right-0 top-full flex-col gap-1 border-b border-line bg-white p-4 md:static md:flex md:flex-row md:items-center md:border-0 md:p-0"}
            onClick={() => setOpen(false)}
          >
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navCls}>
                {l.label}
              </NavLink>
            ))}
            {canAdmin(session?.user) && (
              <NavLink to="/admin" className={navCls}>
                Admin
              </NavLink>
            )}
            {session ? (
              <>
                {session.user.role === "customer" && (
                  <NavLink to="/hesab" className={navCls}>
                    Rezervasiyalarım
                  </NavLink>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setSession(null)}>
                  Çıxış
                </button>
              </>
            ) : (
              <Link to={"/daxil-ol?next=" + encodeURIComponent(pathname)} className="btn btn-brand">
                Daxil ol
              </Link>
            )}
          </nav>
        </div>
      </header>
      {/* The admin page has its own demo note (with the reset button); one note is enough there. */}
      {pathname === "/admin" || pathname.startsWith("/admin/") ? null : <DemoBanner />}
      <main id="main" className="min-h-[60vh]">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
