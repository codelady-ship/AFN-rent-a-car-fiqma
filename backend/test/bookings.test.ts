// Booking rules: date checks, atomic conflict check, server-side price, ownership and the status flow.
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminToken, customer, isoIn, startHarness } from "./setup";

let app: Express;
let stop: () => Promise<void>;
let admin: string;
let cars: { id: string; model: string; pricePerDay: number; available: boolean }[];
let locations: { id: string; name: string; deliveryFee: number }[];

const guest = (car: string, from: string, to: string, extra: object = {}) =>
  request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994 50 000 00 00", car, from, to, ...extra });

beforeAll(async () => {
  ({ app, stop } = await startHarness());
  admin = await adminToken(app);
  cars = (await request(app).get("/api/cars?available=true")).body;
  locations = (await request(app).get("/api/locations")).body;
});
afterAll(() => stop());

describe("dates", () => {
  it("rejects same-day, end before start, past dates and too long rentals", async () => {
    const car = cars[0].id;
    const same = await guest(car, isoIn(10), isoIn(10));
    expect(same.status).toBe(400);
    expect(same.body.details[0].field).toBe("to");
    expect((await guest(car, isoIn(12), isoIn(10))).status).toBe(400);
    const past = await guest(car, isoIn(-2), isoIn(2));
    expect(past.status).toBe(400);
    expect(past.body.details[0].field).toBe("from");
    expect((await guest(car, isoIn(1), isoIn(70))).status).toBe(400);
    expect((await guest(car, "2026-02-30", "2026-03-02")).status).toBe(400);
  });

  it("back-to-back rentals are fine: the return day is free for the next pick-up", async () => {
    const car = cars[1].id;
    expect((await guest(car, isoIn(20), isoIn(23))).status).toBe(201);
    expect((await guest(car, isoIn(23), isoIn(25))).status).toBe(201);
    expect((await guest(car, isoIn(18), isoIn(20))).status).toBe(201);
  });

  it("refuses any overlap: inside, around, start and end", async () => {
    const car = cars[2].id;
    expect((await guest(car, isoIn(30), isoIn(35))).status).toBe(201);
    for (const [a, b] of [
      [31, 33],
      [28, 37],
      [29, 31],
      [34, 36],
      [30, 35],
    ]) {
      expect((await guest(car, isoIn(a), isoIn(b))).status, `${a}-${b}`).toBe(409);
    }
  });

  it("two parallel requests for the same days: exactly one wins", async () => {
    const car = cars[3].id;
    const results = await Promise.all(Array.from({ length: 6 }, () => guest(car, isoIn(40), isoIn(44))));
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    // the losers left no half-claimed days behind: the next free days can still be booked
    expect((await guest(car, isoIn(44), isoIn(46))).status).toBe(201);
    expect((await guest(car, isoIn(38), isoIn(40))).status).toBe(201);
  });

  it("partly overlapping parallel requests: one wins, the other leaves no slots", async () => {
    const car = cars[4].id;
    const [a, b] = await Promise.all([guest(car, isoIn(50), isoIn(54)), guest(car, isoIn(52), isoIn(56))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loserFrom = a.status === 409 ? 50 : 52;
    const winnerTo = a.status === 201 ? 54 : 56;
    // days only the loser wanted are free again
    if (loserFrom === 50) expect((await guest(car, isoIn(50), isoIn(52))).status).toBe(201);
    else expect((await guest(car, isoIn(winnerTo), isoIn(56))).status).toBe(201);
  });
});

describe("price", () => {
  it("is computed on the server from the car, extras and the place", async () => {
    const car = cars[5];
    const airport = locations.find((l) => l.deliveryFee > 0)!;
    const body = { car: car.id, from: isoIn(60), to: isoIn(63), extras: ["child-seat", "gps", "gps"], location: airport.id };
    const q = await request(app).post("/api/bookings/quote").send({ ...body, total: 1, pricePerDay: 1 });
    expect(q.status).toBe(200);
    expect(q.body.days).toBe(3);
    expect(q.body.carTotal).toBe(3 * car.pricePerDay);
    expect(q.body.extras).toHaveLength(2);
    expect(q.body.extrasTotal).toBe(3 * (8 + 5));
    expect(q.body.deliveryFee).toBe(airport.deliveryFee);
    expect(q.body.total).toBe(3 * car.pricePerDay + 39 + airport.deliveryFee);
    const made = await guest(car.id, isoIn(60), isoIn(63), { extras: ["child-seat", "gps"], location: airport.id, total: 5 });
    expect(made.status).toBe(201);
    expect(made.body.total).toBe(q.body.total);
    expect((await request(app).post("/api/bookings/quote").send({ ...body, extras: ["jetpack"] })).status).toBe(400);
  });
});

describe("customer bookings", () => {
  it("needs a customer login; lists only own bookings; others cannot cancel them", async () => {
    const car = cars[6].id;
    const body = { name: "Aysel Məmmədova", phone: "+994 50 123 45 67", car, from: isoIn(70), to: isoIn(72) };
    expect((await request(app).post("/api/bookings").send(body)).status).toBe(401);
    // an admin token is not a customer token
    expect((await request(app).post("/api/bookings").set("Authorization", `Bearer ${admin}`).send(body)).status).toBe(403);

    const alice = await customer(app, "Aysel Məmmədova");
    const bob = await customer(app, "Bəhruz Əliyev");
    const made = await request(app).post("/api/bookings").set("Authorization", `Bearer ${alice.token}`).send(body);
    expect(made.status).toBe(201);
    expect(made.body.status).toBe("pending");

    const mineA = (await request(app).get("/api/bookings/mine").set("Authorization", `Bearer ${alice.token}`)).body;
    const mineB = (await request(app).get("/api/bookings/mine").set("Authorization", `Bearer ${bob.token}`)).body;
    expect(mineA).toHaveLength(1);
    expect(mineB).toHaveLength(0);

    const bobCancel = await request(app).patch(`/api/bookings/${made.body.id}/cancel`).set("Authorization", `Bearer ${bob.token}`);
    expect(bobCancel.status).toBe(404);
    expect((await request(app).get("/api/admin/bookings").set("Authorization", `Bearer ${bob.token}`)).status).toBe(403);

    const cancel = await request(app).patch(`/api/bookings/${made.body.id}/cancel`).set("Authorization", `Bearer ${alice.token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe("cancelled");
    // the days are free again
    expect((await guest(car, isoIn(70), isoIn(72))).status).toBe(201);
  });
});

describe("status flow", () => {
  it("pending → confirmed → completed; finished bookings cannot change", async () => {
    const auth = { Authorization: `Bearer ${admin}` };
    const made = await guest(cars[7].id, isoIn(80), isoIn(82));
    const id = made.body.id;
    expect((await request(app).patch(`/api/admin/bookings/${id}`).set(auth).send({ status: "completed" })).status).toBe(409);
    expect((await request(app).patch(`/api/admin/bookings/${id}`).set(auth).send({ status: "confirmed" })).body.status).toBe("confirmed");
    expect((await request(app).patch(`/api/admin/bookings/${id}`).set(auth).send({ status: "completed" })).body.status).toBe("completed");
    expect((await request(app).patch(`/api/admin/bookings/${id}`).set(auth).send({ status: "cancelled" })).status).toBe(409);
    expect((await request(app).patch(`/api/admin/bookings/${id}`).set(auth).send({ status: "lost" })).status).toBe(400);
    expect((await request(app).get(`/api/cars/${cars[7].id}/busy`)).body.days).toContain(isoIn(80));
  });

  it("availability filter hides cars booked in the range", async () => {
    const car = cars[8].id;
    await guest(car, isoIn(90), isoIn(93));
    const free = (await request(app).get(`/api/cars?from=${isoIn(91)}&to=${isoIn(92)}`)).body.map((c: { id: string }) => c.id);
    expect(free).not.toContain(car);
    expect(free).not.toContain((await request(app).get("/api/cars?available=false")).body[0].id);
    const later = (await request(app).get(`/api/cars?from=${isoIn(93)}&to=${isoIn(95)}`)).body.map((c: { id: string }) => c.id);
    expect(later).toContain(car);
  });
});
