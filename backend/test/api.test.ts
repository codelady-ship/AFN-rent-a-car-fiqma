// Catalogue, guest reservations, admin CRUD and CORS (the first API version's tests, kept green).
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminToken, isoIn, startHarness } from "./setup";

let app: Express;
let stop: () => Promise<void>;
let token: string;

beforeAll(async () => {
  ({ app, stop } = await startHarness());
});
afterAll(() => stop());

describe("catalogue", () => {
  it("health and seeded catalogue", async () => {
    expect((await request(app).get("/api/health")).body.ok).toBe(true);
    expect((await request(app).get("/api/slides")).body).toHaveLength(4);
    const cats = await request(app).get("/api/categories");
    expect(cats.body[0].name).toBe("Hamısı");
    const cars = await request(app).get("/api/cars");
    expect(cars.body).toHaveLength(13);
    expect(cars.body[0].id).toBeTruthy();
    expect(cars.body[0]._id).toBeUndefined();
    const eco = await request(app).get("/api/cars?category=Ekonom");
    expect(eco.body.length).toBeGreaterThan(0);
    expect(eco.body.every((c: { category: string }) => c.category === "Ekonom")).toBe(true);
  });

  it("filters: price, seats, gearbox, search, sort", async () => {
    const cheap = (await request(app).get("/api/cars?maxPrice=50")).body;
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((c: { pricePerDay: number }) => c.pricePerDay <= 50)).toBe(true);
    const big = (await request(app).get("/api/cars?seats=7")).body;
    expect(big.every((c: { seats: number }) => c.seats >= 7)).toBe(true);
    const manual = (await request(app).get("/api/cars?transmission=Mexaniki")).body;
    expect(manual.map((c: { model: string }) => c.model)).toContain("Ford Focus");
    const hy = (await request(app).get("/api/cars?q=hyundai")).body;
    expect(hy.every((c: { brand: string }) => c.brand === "Hyundai")).toBe(true);
    const sorted = (await request(app).get("/api/cars?sort=-price")).body;
    expect(sorted[0].pricePerDay).toBeGreaterThanOrEqual(sorted[1].pricePerDay);
    expect((await request(app).get("/api/cars?from=" + isoIn(3))).status).toBe(400);
    expect((await request(app).get("/api/cars?sort=evil")).status).toBe(400);
    // a regex in the search box is treated as text
    expect((await request(app).get("/api/cars?q=" + encodeURIComponent(".*"))).body).toHaveLength(0);
  });

  it("locations and extras", async () => {
    const locs = (await request(app).get("/api/locations")).body;
    expect(locs).toHaveLength(3);
    const extras = (await request(app).get("/api/extras")).body;
    expect(extras.find((e: { key: string }) => e.key === "child-seat").pricePerDay).toBe(8);
  });

  it("car by id: 200 with rating, bad id 404", async () => {
    const [car] = (await request(app).get("/api/cars")).body;
    const one = await request(app).get(`/api/cars/${car.id}`);
    expect(one.body.model).toBe(car.model);
    expect(one.body.rating).toHaveProperty("average");
    expect((await request(app).get("/api/cars/nope")).status).toBe(404);
    expect((await request(app).get("/api/cars/64b7f0f0f0f0f0f0f0f0f0f0")).status).toBe(404);
  });
});

describe("guest reservation", () => {
  it("valid request gets a reference and a server-side total; overlap is refused", async () => {
    const car = (await request(app).get("/api/cars?available=true")).body[0];
    const res = await request(app)
      .post("/api/reservations")
      .send({ name: "Test Müştəri", phone: "+994 50 000 00 00", car: car.id, from: isoIn(3), to: isoIn(6), total: 1 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.reference).toMatch(/^AFN-[0-9A-F]{6}$/);
    expect(res.body.days).toBe(3);
    expect(res.body.total).toBe(3 * car.pricePerDay);

    const clash = await request(app)
      .post("/api/reservations")
      .send({ name: "Başqa Müştəri", phone: "+994 55 111 11 11", car: car.id, from: isoIn(4), to: isoIn(8) });
    expect(clash.status).toBe(409);
  });

  it("validation errors", async () => {
    const car = (await request(app).get("/api/cars?available=true")).body[1];
    const bad = await request(app).post("/api/reservations").send({ name: "A", phone: "12", car: car.id, from: isoIn(5), to: isoIn(5) });
    expect(bad.status).toBe(400);
    const fields = bad.body.details.map((d: { field: string }) => d.field);
    expect(fields).toContain("name");
    expect(fields).toContain("phone");

    const past = await request(app)
      .post("/api/reservations")
      .send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2020-01-01", to: "2020-01-03" });
    expect(past.status).toBe(400);

    const busy = (await request(app).get("/api/cars")).body.find((c: { available: boolean }) => !c.available);
    expect(busy).toBeTruthy();
    const r = await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: busy.id, from: isoIn(1), to: isoIn(2) });
    expect(r.status).toBe(409);
    expect((await request(app).post("/api/reservations").set("Content-Type", "application/json").send("{bad")).status).toBe(400);
  });
});

describe("admin", () => {
  it("login required, wrong password rejected", async () => {
    expect((await request(app).get("/api/reservations")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "wrong" })).status).toBe(401);
    const ok = await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe("admin");
    token = await adminToken(app);
  });

  it("car CRUD and reservation status", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const body = { model: "Kia Rio", brand: "Kia", year: 2022, category: "Ekonom", fuelType: "Benzin", transmission: "Avtomatik", engine: "1.4", seats: 5, pricePerDay: 45, image: "/fotos/cars/kia-rio.webp" };
    const created = await request(app).post("/api/cars").set(auth).send(body);
    expect(created.status).toBe(201);
    expect((await request(app).post("/api/cars").set(auth).send({ ...body, category: "Yox" })).status).toBe(400);
    const upd = await request(app).put(`/api/cars/${created.body.id}`).set(auth).send({ pricePerDay: 50 });
    expect(upd.body.pricePerDay).toBe(50);
    expect((await request(app).delete(`/api/cars/${created.body.id}`).set(auth)).status).toBe(204);

    const list = await request(app).get("/api/reservations").set(auth);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
    const patched = await request(app).patch(`/api/reservations/${list.body[0].id}`).set(auth).send({ status: "confirmed" });
    expect(patched.body.status).toBe("confirmed");
  });

  it("cannot delete a car with open bookings", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const [booking] = (await request(app).get("/api/admin/bookings?status=confirmed").set(auth)).body;
    expect((await request(app).delete(`/api/cars/${booking.car}`).set(auth)).status).toBe(409);
  });

  it("location CRUD and stats", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const loc = await request(app).post("/api/locations").set(auth).send({ name: "Gəncə ofisi", type: "office" });
    expect(loc.status).toBe(201);
    expect((await request(app).get("/api/locations")).body).toHaveLength(4);
    await request(app).put(`/api/locations/${loc.body.id}`).set(auth).send({ active: false });
    expect((await request(app).get("/api/locations")).body).toHaveLength(3);
    expect((await request(app).delete(`/api/locations/${loc.body.id}`).set(auth)).status).toBe(204);
    const stats = await request(app).get("/api/admin/stats").set(auth);
    expect(stats.body.cars).toBe(13);
    expect(stats.body.bookings.confirmed).toBeGreaterThanOrEqual(1);
  });
});

// Tests added in #4's review round, kept as they were (ported to vitest).
describe("#4 review: atomic bookings and real dates", () => {
  it("parallel requests for the same car and dates -> exactly one 201", async () => {
    const car = (await request(app).get("/api/cars?available=true")).body[2];
    const body = (i: number) => ({ name: "Paralel Müştəri", phone: "+994 50 000 00 0" + i, car: car.id, from: isoIn(20), to: isoIn(24) });
    const statuses = (await Promise.all(Array.from({ length: 8 }, (_, i) => request(app).post("/api/reservations").send(body(i))))).map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    // overlapping in parallel from both sides: still one winner
    const a = { ...body(8), from: isoIn(30), to: isoIn(33) };
    const b = { ...body(9), from: isoIn(32), to: isoIn(35) };
    const pair = (await Promise.all([request(app).post("/api/reservations").send(a), request(app).post("/api/reservations").send(b)])).map((r) => r.status);
    expect(pair.sort()).toEqual([201, 409]);
    // back-to-back is fine: the return day is free for the next customer
    const next = await request(app).post("/api/reservations").send({ ...body(7), from: isoIn(24), to: isoIn(26) });
    expect(next.status, JSON.stringify(next.body)).toBe(201);
  });

  it("impossible calendar dates are rejected", async () => {
    const car = (await request(app).get("/api/cars?available=true")).body[3];
    const res = await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2027-02-30", to: "2027-03-05" });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("from");
    expect((await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2027-13-01", to: "2027-13-03" })).status).toBe(400);
  });

  it("admin: cancelling frees the days, re-opening checks them again", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const car = (await request(app).get("/api/cars?available=true")).body[4];
    const body = { name: "Test Müştəri", phone: "+994500000000", car: car.id, from: isoIn(40), to: isoIn(42) };
    const first = await request(app).post("/api/reservations").send(body);
    expect(first.status).toBe(201);
    const id = (await request(app).get("/api/reservations").set(auth)).body.find((r: { reference: string }) => r.reference === first.body.reference).id;
    expect((await request(app).post("/api/reservations").send(body)).status).toBe(409);
    expect((await request(app).patch(`/api/reservations/${id}`).set(auth).send({ status: "cancelled" })).body.status).toBe("cancelled");
    expect((await request(app).post("/api/reservations").send(body)).status).toBe(201); // days are free again
    expect((await request(app).patch(`/api/reservations/${id}`).set(auth).send({ status: "pending" })).status).toBe(409);
  });
});

describe("CORS and errors", () => {
  it("allowed origin echoed, unknown origin refused", async () => {
    const ok = await request(app).get("/api/cars").set("Origin", "https://codelady-ship.github.io");
    expect(ok.headers["access-control-allow-origin"]).toBe("https://codelady-ship.github.io");
    expect((await request(app).get("/api/cars").set("Origin", "https://evil.example")).status).toBe(403);
  });

  it("unknown route is a JSON 404 without a stack", async () => {
    const res = await request(app).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
