import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

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
        source: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /hesab\n\nSitemap: ${site}/sitemap.xml\n`,
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

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), seoFiles()],
  // the demo fleet is read from the backend seed file, so both stay in sync
  server: { fs: { allow: [".."] } },
  build: { target: "es2020" },
  test: { environment: "node" },
});
