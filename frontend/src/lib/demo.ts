// Offline demo backend: the same rules as the API, run in the browser.
// Used when VITE_API_URL is not set (for example on GitHub Pages) or the API cannot be reached.
// Data the visitor creates is kept only in this browser (localStorage).
import { ApiError, type Booking, type BookingInput, type Car, type CarFilters, type Location, type Message, type Review, type Session, type Stats, type User } from "./types";
import { DESCRIPTIONS, EXTRAS, FEATURED, LOCATIONS, MAX_RENTAL_DAYS, REVIEWS, TRANSITIONS, dayDiff, daysBetween, isIsoDay, seedData, todayInBaku } from "./shared";

export const DEMO_ADMIN = { email: "admin@afn.demo", password: "demo12345" };

type Store = {
  users: (User & { password: string })[];
  bookings: (Booking & { user?: string })[];
  messages: Message[];
  reviews: (Review & { car: string; user?: string })[];
  cars: Car[];
};

const KEY = "afn-demo-v1";
const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16);

const seedCars = (): Car[] =>
  seedData.cars.map((c) => ({ ...c, id: "demo-" + c.id, featured: FEATURED.includes(c.model), description: DESCRIPTIONS[c.category] ?? "" }));

export const demoLocations: Location[] = LOCATIONS.map((l, i) => ({ ...l, id: "loc-" + (i + 1), active: true }));

function fresh(): Store {
  const cars = seedCars();
  return {
    users: [{ id: "u-admin", name: "AFN admin", email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, role: "admin" }],
    bookings: [],
    messages: [],
    reviews: REVIEWS.flatMap(([model, authorName, rating, comment], i) => {
      const car = cars.find((c) => c.model === model);
      return car ? [{ id: "r" + i, car: car.id, authorName, rating, comment }] : [];
    }),
    cars,
  };
}

let memory: Store | null = null;
function load(): Store {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as Store) : fresh();
  } catch {
    memory = fresh();
  }
  return memory;
}
function save() {
  try {
    if (memory) localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode: keep it in memory */
  }
}

const field = (f: string, m: string, status = 400) => new ApiError(status, "Validation failed", [{ field: f, message: m }]);
const sessionFor = (u: User): Session => ({ token: "demo:" + u.id, user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role } });
const userOf = (token?: string) => (token?.startsWith("demo:") ? load().users.find((u) => "demo:" + u.id === token) : undefined);
const need = (token: string | undefined, role?: "admin" | "customer") => {
  const u = userOf(token);
  if (!u) throw new ApiError(401, "Login required");
  if (role && u.role !== role) throw new ApiError(403, "Not allowed");
  return u;
};
const busy = (carId: string, ignore?: string) =>
  new Set(load().bookings.filter((b) => b.car === carId && b.status !== "cancelled" && b.id !== ignore).flatMap((b) => daysBetween(b.from, b.to)));

export const demo = {
  async cars(f: CarFilters = {}) {
    let list = load().cars.slice();
    if (f.category && f.category !== "Hamısı") list = list.filter((c) => c.category === f.category);
    if (f.minPrice != null) list = list.filter((c) => c.pricePerDay >= f.minPrice!);
    if (f.maxPrice != null) list = list.filter((c) => c.pricePerDay <= f.maxPrice!);
    if (f.seats) list = list.filter((c) => c.seats >= f.seats!);
    if (f.transmission) list = list.filter((c) => c.transmission === f.transmission);
    if (f.fuel) list = list.filter((c) => c.fuelType === f.fuel);
    if (f.q) list = list.filter((c) => (c.brand + " " + c.model).toLowerCase().includes(f.q!.toLowerCase()));
    if (f.from && f.to) {
      const want = daysBetween(f.from, f.to);
      list = list.filter((c) => c.available && !want.some((d) => busy(c.id).has(d)));
    }
    if (f.sort) {
      const k = f.sort.replace("-", "") === "price" ? "pricePerDay" : "year";
      const dir = f.sort.startsWith("-") ? -1 : 1;
      list.sort((a, b) => (a[k] - b[k]) * dir);
    }
    return list;
  },
  async car(id: string) {
    const car = load().cars.find((c) => c.id === id);
    if (!car) throw new ApiError(404, "Car not found");
    const rs = load().reviews.filter((r) => r.car === id);
    const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
    return { ...car, rating: { average: Math.round(avg * 10) / 10, count: rs.length } };
  },
  async busy(id: string) {
    const today = todayInBaku();
    return [...busy(id)].filter((d) => d >= today).sort();
  },
  async reviews(id: string) {
    return load().reviews.filter((r) => r.car === id).reverse();
  },
  async addReview(token: string, carId: string, rating: number, comment: string) {
    const u = need(token, "customer");
    if (!load().bookings.some((b) => b.car === carId && b.user === u.id && b.status === "completed")) {
      throw new ApiError(403, "Rəy yazmaq üçün bu avtomobili icarəyə götürüb qaytarmış olmalısınız.");
    }
    if (load().reviews.some((r) => r.car === carId && r.user === u.id)) throw new ApiError(409, "Already exists");
    const r = { id: uid(), car: carId, user: u.id, authorName: u.name, rating, comment };
    load().reviews.push(r);
    save();
    return r;
  },
  async locations() {
    return demoLocations;
  },
  async quote(input: Omit<BookingInput, "name" | "phone">) {
    const { from, to } = input;
    if (!isIsoDay(from)) throw field("from", "Götürmə tarixini seçin.");
    if (!isIsoDay(to)) throw field("to", "Qaytarma tarixini seçin.");
    if (from < todayInBaku()) throw field("from", "Keçmiş tarix seçmək olmaz.");
    const days = dayDiff(from, to);
    if (days < 1) throw field("to", "Qaytarma tarixi götürmə tarixindən sonra olmalıdır.");
    if (days > MAX_RENTAL_DAYS) throw field("to", `Ən çox ${MAX_RENTAL_DAYS} günlük rezervasiya etmək olar.`);
    const car = load().cars.find((c) => c.id === input.car);
    if (!car) throw field("car", "Avtomobil seçin.");
    if (!car.available) throw new ApiError(409, "Bu avtomobil hazırda icarədədir.");
    const loc = demoLocations.find((l) => l.id === input.location) ?? demoLocations[0];
    const extras = [...new Set(input.extras)].flatMap((k) => {
      const e = EXTRAS.find((x) => x.key === k);
      return e ? [{ key: e.key, name: e.name, pricePerDay: e.pricePerDay, total: e.pricePerDay * days }] : [];
    });
    const carTotal = car.pricePerDay * days;
    const extrasTotal = extras.reduce((s, e) => s + e.total, 0);
    return { car, days, pricePerDay: car.pricePerDay, carTotal, extras, extrasTotal, deliveryFee: loc.deliveryFee, total: carTotal + extrasTotal + loc.deliveryFee, place: loc.name };
  },
  async book(input: BookingInput, token?: string) {
    const u = token ? need(token, "customer") : undefined;
    if (input.name.trim().length < 3) throw field("name", "Ad və soyadı yazın (ən azı 3 hərf).");
    if (!/^[+]?[0-9 ()-]{9,20}$/.test(input.phone.trim())) throw field("phone", "Telefon nömrəsini düzgün yazın.");
    const { car, ...q } = await demo.quote(input);
    const taken = busy(car.id);
    if (daysBetween(input.from, input.to).some((d) => taken.has(d))) {
      throw new ApiError(409, "Bu tarixlərdə avtomobil artıq rezerv olunub. Başqa tarix seçin.");
    }
    const b: Booking & { user?: string } = {
      ...q,
      id: uid(),
      reference: "AFN-" + Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, "0"),
      car: car.id,
      carModel: car.model,
      from: input.from,
      to: input.to,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email,
      note: input.note,
      status: "pending",
      createdAt: new Date().toISOString(),
      user: u?.id,
    };
    load().bookings.unshift(b);
    save();
    return b;
  },
  async mine(token: string) {
    const u = need(token, "customer");
    return load().bookings.filter((b) => b.user === u.id);
  },
  async cancel(token: string, id: string) {
    const u = need(token, "customer");
    const b = load().bookings.find((x) => x.id === id && x.user === u.id);
    if (!b) throw new ApiError(404, "Booking not found");
    if (b.from <= todayInBaku()) throw new ApiError(409, "Götürmə günü gəlib çatıb; ləğv üçün bizə zəng edin.");
    return demo.setStatus("", id, "cancelled", true);
  },
  async register(name: string, email: string, password: string, phone?: string) {
    const s = load();
    email = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === email)) throw field("email", "Bu e-poçt artıq qeydiyyatdan keçib.", 409);
    if (password.length < 8) throw field("password", "Şifrə ən azı 8 simvol olmalıdır.");
    const u = { id: uid(), name: name.trim(), email, phone, password, role: "customer" as const };
    s.users.push(u);
    save();
    return sessionFor(u);
  },
  async login(email: string, password: string) {
    const u = load().users.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!u) throw new ApiError(401, "E-poçt və ya şifrə yanlışdır.");
    return sessionFor(u);
  },
  async contact(m: Omit<Message, "id" | "status">) {
    if (m.message.trim().length < 10) throw field("message", "Mesaj ən azı 10 simvol olmalıdır.");
    load().messages.unshift({ ...m, id: uid(), status: "new", createdAt: new Date().toISOString() });
    save();
    return { status: "received" };
  },
  // ----- admin
  async stats(token: string): Promise<Stats> {
    need(token, "admin");
    const s = load();
    const count = (st: string) => s.bookings.filter((b) => b.status === st).length;
    return {
      cars: s.cars.length,
      customers: s.users.filter((u) => u.role === "customer").length,
      newMessages: s.messages.filter((m) => m.status === "new").length,
      bookings: { pending: count("pending"), confirmed: count("confirmed"), completed: count("completed"), cancelled: count("cancelled") },
      revenue: s.bookings.filter((b) => b.status === "confirmed" || b.status === "completed").reduce((t, b) => t + b.total, 0),
      bookedDays: s.bookings.filter((b) => b.status !== "cancelled").reduce((t, b) => t + b.days, 0),
    };
  },
  async allBookings(token: string, status?: string) {
    need(token, "admin");
    return load().bookings.filter((b) => !status || b.status === status);
  },
  async setStatus(token: string, id: string, next: Booking["status"], skipAuth = false) {
    if (!skipAuth) need(token, "admin");
    const b = load().bookings.find((x) => x.id === id);
    if (!b) throw new ApiError(404, "Booking not found");
    if (b.status !== next && !TRANSITIONS[b.status].includes(next)) throw new ApiError(409, `Status cannot change from ${b.status} to ${next}`);
    b.status = next;
    save();
    return b;
  },
  async messages(token: string) {
    need(token, "admin");
    return load().messages;
  },
  async setMessage(token: string, id: string, status: Message["status"]) {
    need(token, "admin");
    const m = load().messages.find((x) => x.id === id);
    if (!m) throw new ApiError(404, "Message not found");
    m.status = status;
    save();
    return m;
  },
  async deleteMessage(token: string, id: string) {
    need(token, "admin");
    const s = load();
    s.messages = s.messages.filter((m) => m.id !== id);
    save();
  },
  async saveCar(token: string, car: Partial<Car> & { id?: string }) {
    need(token, "admin");
    const s = load();
    if (car.id) {
      const i = s.cars.findIndex((c) => c.id === car.id);
      if (i < 0) throw new ApiError(404, "Car not found");
      s.cars[i] = { ...s.cars[i], ...car } as Car;
      save();
      return s.cars[i];
    }
    const c = { ...(car as Car), id: uid(), available: car.available ?? true };
    s.cars.push(c);
    save();
    return c;
  },
  async deleteCar(token: string, id: string) {
    need(token, "admin");
    const s = load();
    if (s.bookings.some((b) => b.car === id && (b.status === "pending" || b.status === "confirmed"))) {
      throw new ApiError(409, "Bu avtomobilin aktiv rezervasiyaları var.");
    }
    s.cars = s.cars.filter((c) => c.id !== id);
    save();
  },
  reset() {
    memory = fresh();
    save();
  },
};
