// One API surface for the whole app. With VITE_API_URL it talks to the Express API;
// without it (or when the API cannot be reached for reading) it uses the in-browser demo.
import { demo } from "./demo";
import { ApiError, type Booking, type BookingInput, type Car, type CarFilters, type Location, type Message, type Quote, type Review, type Session, type Stats } from "./types";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

let offline = !BASE;
const listeners = new Set<() => void>();
export const isDemo = () => offline;
export const onModeChange = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const goOffline = () => {
  if (offline) return;
  offline = true;
  listeners.forEach((fn) => fn());
};

async function http<T>(path: string, init: RequestInit & { token?: string; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000); // Render's free plan can take a while to wake up
  let res: Response;
  try {
    res = await fetch(BASE + "/api" + path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, "Serverə qoşulmaq alınmadı. İnterneti yoxlayıb yenidən cəhd edin.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || "Xəta baş verdi", body.details || []);
  return body as T;
}

/** Reads fall back to the demo data if the API is down, so the site never shows an empty fleet. */
async function read<T>(live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (offline) return fallback();
  try {
    return await live();
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      goOffline();
      return fallback();
    }
    throw err;
  }
}

const qs = (f: CarFilters) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && v !== null && p.set(k, String(v)));
  const s = p.toString();
  return s ? "?" + s : "";
};

export const api = {
  cars: (f: CarFilters = {}) => read(() => http<Car[]>("/cars" + qs(f)), () => demo.cars(f)),
  car: (id: string) => read(() => http<Car>(`/cars/${encodeURIComponent(id)}`), () => demo.car(id)),
  busy: (id: string) => read(async () => (await http<{ days: string[] }>(`/cars/${encodeURIComponent(id)}/busy`)).days, () => demo.busy(id)),
  reviews: (id: string) => read(() => http<Review[]>(`/cars/${encodeURIComponent(id)}/reviews`), () => demo.reviews(id)),
  locations: () => read(() => http<Location[]>("/locations"), () => demo.locations()),

  quote: (input: Omit<BookingInput, "name" | "phone">): Promise<Quote> =>
    offline ? demo.quote(input) : http<Quote>("/bookings/quote", { method: "POST", json: input }),
  book: (input: BookingInput, token?: string): Promise<Booking> =>
    offline ? demo.book(input, token) : http<Booking>(token ? "/bookings" : "/reservations", { method: "POST", json: input, token }),
  mine: (token: string) => (offline ? demo.mine(token) : http<Booking[]>("/bookings/mine", { token })),
  cancel: (token: string, id: string) => (offline ? demo.cancel(token, id) : http<Booking>(`/bookings/${id}/cancel`, { method: "PATCH", token })),
  addReview: (token: string, carId: string, rating: number, comment: string) =>
    offline ? demo.addReview(token, carId, rating, comment) : http<Review>(`/cars/${carId}/reviews`, { method: "POST", token, json: { rating, comment } }),

  login: (email: string, password: string): Promise<Session> =>
    offline ? demo.login(email, password) : http<Session>("/auth/login", { method: "POST", json: { email, password } }),
  register: (name: string, email: string, password: string, phone?: string): Promise<Session> =>
    offline ? demo.register(name, email, password, phone) : http<Session>("/auth/register", { method: "POST", json: { name, email, password, phone } }),

  contact: (m: Omit<Message, "id" | "status">) => (offline ? demo.contact(m) : http("/contact", { method: "POST", json: m })),

  admin: {
    stats: (t: string) => (offline ? demo.stats(t) : http<Stats>("/admin/stats", { token: t })),
    bookings: (t: string, status?: string) => (offline ? demo.allBookings(t, status) : http<Booking[]>("/admin/bookings" + (status ? `?status=${status}` : ""), { token: t })),
    setStatus: (t: string, id: string, status: Booking["status"]) =>
      offline ? demo.setStatus(t, id, status) : http<Booking>(`/admin/bookings/${id}`, { method: "PATCH", token: t, json: { status } }),
    messages: (t: string) => (offline ? demo.messages(t) : http<Message[]>("/admin/messages", { token: t })),
    setMessage: (t: string, id: string, status: Message["status"]) =>
      offline ? demo.setMessage(t, id, status) : http<Message>(`/admin/messages/${id}`, { method: "PATCH", token: t, json: { status } }),
    deleteMessage: (t: string, id: string) => (offline ? demo.deleteMessage(t, id) : http<void>(`/admin/messages/${id}`, { method: "DELETE", token: t })),
    saveCar: (t: string, car: Partial<Car> & { id?: string }) => {
      if (offline) return demo.saveCar(t, car);
      const { id, rating: _r, ...body } = car;
      return id ? http<Car>(`/cars/${id}`, { method: "PUT", token: t, json: body }) : http<Car>("/cars", { method: "POST", token: t, json: body });
    },
    deleteCar: (t: string, id: string) => (offline ? demo.deleteCar(t, id) : http<void>(`/cars/${id}`, { method: "DELETE", token: t })),
  },
};
