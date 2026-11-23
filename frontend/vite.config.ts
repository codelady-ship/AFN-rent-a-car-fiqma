import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import seed from "../backend/src/data/rentAcar.json";
import { demoCarPath, pageFile } from "./src/lib/prerender";
import { PAGE_META, carMeta, fullTitle, type PageMeta } from "./src/lib/routeMeta";

// VITE_BASE is "/" on Vercel and "/AFN-rent-a-car-fiqma/" for the GitHub Pages build.
const base = process.env.VITE_BASE || "/";
process.env.VITE_SITE_URL ||= "https://afn-rent-a-car.vercel.app";
const site = process.env.VITE_SITE_URL.replace(/\/$/, "");

const ROUTES = ["/", "/park", "/rezervasiya", "/elaqe"];

/** robots.txt, sitemap.xml and llms.txt with the real site address. */
function seoFiles(): Plugin {
  return {
    name: "afn-seo-files",
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = ROUTES.map((r) => `  <url><loc>${site}${r}</loc><lastmod>${today}</lastmod></url>`).join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        // No Disallow: sign-in, my bookings, admin and 404 send <meta name="robots" content="noindex">, which a
        // Disallow would hide from crawlers (and in the GitHub Pages build this file sits under the repo path).
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "llms.txt",
        source: [
          "# AFN rent a car",
          "",
          "> Car rental in Baku, Azerbaijan (site language: Azerbaijani). Economy, business, premium, crossover/SUV cars and coaches; online booking, airport and address delivery.",
          "",
          "- Office: Xocalı prospekti 13, Bakı. Phone: +994 50 394 91 94, +994 12 490 11 64. E-mail: info@afnrentacar.az. Open every day 09:00–21:00.",
          "- Prices are per day in AZN, from 40 AZN (economy) to 400 AZN (coach with driver). Extras per day: child seat 8, GPS 5, extra driver 10, full insurance 20, mobile Wi-Fi 6, roof box 12 AZN.",
          "- Pick-up: the office (free), Heydar Aliyev International Airport (+20 AZN), delivery inside Baku (+15 AZN).",
          "- A rental day is a calendar day; the return day is not charged. Bookings are confirmed by a manager by phone.",
          "",
          "## Pages",
          "",
          `- [Home](${site}/): the AFN story, car classes, FAQ and contacts`,
          `- [Fleet](${site}/park): all cars with filters (class, price, seats, gearbox, free dates)`,
          `- [Booking](${site}/rezervasiya): choose a car, dates, place and extras; the price is calculated by the server`,
          `- [Contact](${site}/elaqe): contact form, address and phones`,
          "",
        ].join("\n"),
      });
    },
  };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** index.html with one route's title, description, canonical/og:url, robots and (optionally) og:image. */
function routeHtml(html: string, path: string, meta: PageMeta, image?: string) {
  const title = esc(fullTitle(meta.title));
  const url = site + path;
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"/g, `$1${title}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
    .replace(/(<meta name="robots" content=")[^"]*"/, `$1${meta.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}"`);
  if (meta.description) {
    out = out.replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"/g, `$1${esc(meta.description)}"`);
  }
  if (image) {
    out = out
      .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*"/g, `$1${image}"`)
      .replace(/(<meta property="og:image:alt" content=")[^"]*"/, `$1${title}"`)
      .replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/g, "");
  }
  return out;
}

/**
 * GitHub Pages has no rewrites: an unknown path gets 404.html with HTTP status 404, so SPA deep links used to
 * answer 404 (the page still rendered, but crawlers and link previews saw an error). This writes a copy of
 * index.html for every known route, including each demo car page (/park/demo-1 → park/demo-1.html: the Pages build
 * runs on the in-browser demo fleet), with that route's own
 * meta tags. 404.html stays as the fallback for paths that really do not exist.
 */
function prerenderRoutes(): Plugin {
  let outDir = "dist";
  return {
    name: "afn-prerender-routes",
    apply: "build",
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const html = readFileSync(join(outDir, "index.html"), "utf8");
      const write = (file: string, body: string) => {
        mkdirSync(dirname(join(outDir, file)), { recursive: true });
        writeFileSync(join(outDir, file), body);
      };
      const pages: [string, PageMeta][] = [
        ["park", PAGE_META.park],
        ["rezervasiya", PAGE_META.rezervasiya],
        ["elaqe", PAGE_META.elaqe],
        ["daxil-ol", PAGE_META["daxil-ol"]],
        ["hesab", PAGE_META.hesab],
        ["admin", PAGE_META.admin],
      ];
      for (const [route, meta] of pages) write(`${route}.html`, routeHtml(html, `/${route}`, meta));
      // park/ is also a folder now (the car pages): park/index.html answers /park/ if Pages redirects /park there
      write("park/index.html", routeHtml(html, "/park", PAGE_META.park));
      for (const car of seed.cars) {
        const path = demoCarPath(car.id);
        write(pageFile(path), routeHtml(html, path, carMeta(car), site + car.image));
      }
      write("404.html", routeHtml(html, "/404", PAGE_META.notFound));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), seoFiles(), prerenderRoutes()],
  // the demo fleet is read from the backend seed file, so both stay in sync
  server: { fs: { allow: [".."] } },
  build: { target: "es2020" },
  test: { environment: "node" },
});
