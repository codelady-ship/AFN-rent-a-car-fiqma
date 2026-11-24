// Page titles and descriptions in one place: the pages set them in the browser (useMeta) and the build
// writes them into the prerendered route files (vite.config.ts), so link previews and crawlers that do not
// run JavaScript see the same text. Plain data only: this file is also imported by vite.config.ts.

export type PageMeta = { title: string; description?: string; noindex?: boolean };

/** "Əlaqə" → "Əlaqə | AFN rent a car" (titles that already name AFN stay as they are). */
export const fullTitle = (title: string) => (title.includes("AFN") ? title : `${title} | AFN rent a car`);

export const PAGE_META = {
  home: {
    title: "AFN rent a car – Bakıda avtomobil icarəsi",
    description: "AFN rent a car: Bakıda ekonom, biznes, premium, SUV və avtobus icarəsi. Onlayn rezervasiya, şəffaf qiymət, hava limanına və ünvana çatdırılma.",
  },
  park: {
    title: "Avtopark – icarəyə avtomobillər",
    description: "AFN rent a car avtoparkı, Bakı: ekonom, biznes, premium, krossover/SUV və avtobuslar. Klass, gündəlik qiymət, yer sayı, sürətlər qutusu və tarixə görə filtr.",
  },
  rezervasiya: {
    title: "Onlayn rezervasiya",
    description: "Bakıda onlayn avtomobil rezervasiyası: avtomobili, tarixləri, götürmə yerini (ofis, hava limanı, ünvan) və əlavələri seçin – qiymət dərhal hesablanır.",
  },
  elaqe: {
    title: "Əlaqə",
    description: "AFN rent a car ilə əlaqə: Bakı, Xocalı prospekti 13, +994 50 394 91 94, info@afnrentacar.az. Hər gün 09:00–21:00. Sual, korporativ və avtobus sorğuları.",
  },
  "daxil-ol": {
    title: "Daxil ol və ya qeydiyyat",
    description: "AFN rent a car hesabı: rezervasiyalarınızı izləyin və ləğv edin.",
    noindex: true,
  },
  hesab: { title: "Rezervasiyalarım", noindex: true },
  admin: { title: "Admin panel", noindex: true },
  notFound: { title: "Səhifə tapılmadı", noindex: true },
} satisfies Record<string, PageMeta>;

type CarInfo = { model: string; year: number; seats: number; transmission: string; fuelType: string; pricePerDay: number };

export const carMeta = (car: CarInfo): PageMeta => ({
  title: `${car.model} icarəsi – ${car.pricePerDay} AZN/gün`,
  description: `${car.model} (${car.year}) icarəsi Bakıda: ${car.seats} yer, ${car.transmission}, ${car.fuelType}. Gündəlik ${car.pricePerDay} AZN, onlayn rezervasiya, hava limanına və ünvana çatdırılma – AFN rent a car.`,
});
