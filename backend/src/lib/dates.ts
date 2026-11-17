/** Dates are plain calendar days (YYYY-MM-DD) in Baku time. A booking covers [from, to): the return day is free for the next pick-up. */
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDay = (s: string) => {
  if (!ISO_DAY.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const todayInBaku = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(now);

export const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Every day a car is busy for a rental from → to (the return day is not included). */
export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
};
