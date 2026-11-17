// Code and data shared with the backend (plain TypeScript without server dependencies).
export { CATEGORIES, EXTRAS, MAX_RENTAL_DAYS, TRANSITIONS } from "../../../backend/src/catalog";
export { DESCRIPTIONS, FEATURED, LOCATIONS, REVIEWS } from "../../../backend/src/data/demo";
export { addDays, dayDiff, daysBetween, isIsoDay, todayInBaku } from "../../../backend/src/lib/dates";
import seedData from "../../../backend/src/data/rentAcar.json";
export { seedData };

/** Turns a site path from the data ("/fotos/cars/x.webp") into a URL that works under any base path. */
export const asset = (p: string) => (/^https?:/.test(p) ? p : import.meta.env.BASE_URL + p.replace(/^\.?\//, ""));

export const azn = (n: number) => `${Math.round(n * 100) / 100} AZN`;

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
/** "2026-11-20" → "20 noy 2026" */
export const prettyDay = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Gözləmədə",
  confirmed: "Təsdiqlənib",
  completed: "Başa çatıb",
  cancelled: "Ləğv edilib",
};
