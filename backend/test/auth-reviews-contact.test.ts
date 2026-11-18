// Customer accounts, rate limits, reviews and the contact form.
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminToken, customer, isoIn, startHarness } from "./setup";

let app: Express;
let stop: () => Promise<void>;
let admin: string;

beforeAll(async () => {
  ({ app, stop } = await startHarness());
  admin = await adminToken(app);
});
afterAll(() => stop());

describe("auth", () => {
  it("register, login, me; no password hash in any response", async () => {
    const reg = await request(app).post("/api/auth/register").send({ name: "Leyla Həsənova", email: "Leyla@Test.local", password: "parol12345" });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe("customer");
    expect(reg.body.user.email).toBe("leyla@test.local");
    expect(JSON.stringify(reg.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const dup = await request(app).post("/api/auth/register").send({ name: "Leyla H", email: "leyla@test.local", password: "parol12345" });
    expect(dup.status).toBe(409);
    const login = await request(app).post("/api/auth/login").send({ email: "leyla@test.local", password: "parol12345" });
    expect(login.status).toBe(200);
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.body.name).toBe("Leyla Həsənova");
    expect(me.body.passwordHash).toBeUndefined();
    expect((await request(app).post("/api/auth/login").send({ email: "nobody@test.local", password: "parol12345" })).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer forged.token.here")).status).toBe(401);
  });

  it("weak input is refused", async () => {
    const bad = await request(app).post("/api/auth/register").send({ name: "Le", email: "not-an-email", password: "123" });
    expect(bad.status).toBe(400);
    expect(bad.body.details.map((d: { field: string }) => d.field).sort()).toEqual(["email", "name", "password"]);
  });

  it("customers cannot use admin endpoints", async () => {
    const c = await customer(app);
    const auth = { Authorization: `Bearer ${c.token}` };
    expect((await request(app).get("/api/admin/stats").set(auth)).status).toBe(403);
    expect((await request(app).post("/api/cars").set(auth).send({})).status).toBe(403);
    expect((await request(app).get("/api/admin/messages").set(auth)).status).toBe(403);
  });

  it("login is rate limited", async () => {
    const before = process.env.AUTH_RATE_LIMIT;
    process.env.AUTH_RATE_LIMIT = "3";
    const { createApp } = await import("../src/app");
    const limited = createApp();
    process.env.AUTH_RATE_LIMIT = before;
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      codes.push((await request(limited).post("/api/auth/login").send({ email: "x@test.local", password: "wrong-pass" })).status);
    }
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes[3]).toBe(429);
  });
});

describe("reviews", () => {
  it("only after a completed rental, once per car; admin can remove", async () => {
    const car = (await request(app).get("/api/cars?available=true")).body[0];
    const seeded = (await request(app).get(`/api/cars/${car.id}/reviews`)).body;
    const c = await customer(app, "Orxan Quliyev");
    const auth = { Authorization: `Bearer ${c.token}` };
    expect((await request(app).post(`/api/cars/${car.id}/reviews`).set(auth).send({ rating: 5, comment: "Əla" })).status).toBe(403);

    const b = await request(app).post("/api/bookings").set(auth).send({ name: "Orxan Quliyev", phone: "+994 55 555 55 55", car: car.id, from: isoIn(5), to: isoIn(7) });
    expect(b.status).toBe(201);
    const adm = { Authorization: `Bearer ${admin}` };
    await request(app).patch(`/api/admin/bookings/${b.body.id}`).set(adm).send({ status: "confirmed" });
    await request(app).patch(`/api/admin/bookings/${b.body.id}`).set(adm).send({ status: "completed" });

    expect((await request(app).post(`/api/cars/${car.id}/reviews`).set(auth).send({ rating: 9 })).status).toBe(400);
    const ok = await request(app).post(`/api/cars/${car.id}/reviews`).set(auth).send({ rating: 4, comment: "Təmiz və rahat idi." });
    expect(ok.status).toBe(201);
    expect(ok.body.authorName).toBe("Orxan Quliyev");
    expect((await request(app).post(`/api/cars/${car.id}/reviews`).set(auth).send({ rating: 5 })).status).toBe(409);

    const list = (await request(app).get(`/api/cars/${car.id}/reviews`)).body;
    expect(list).toHaveLength(seeded.length + 1);
    expect(list[0].user).toBeUndefined();
    expect((await request(app).get(`/api/cars/${car.id}`)).body.rating.count).toBe(seeded.length + 1);
    expect((await request(app).delete(`/api/admin/reviews/${ok.body.id}`).set(adm)).status).toBe(204);
  });
});

describe("contact form", () => {
  it("stores a message for the admin; validation and honeypot", async () => {
    const msg = { name: "Kamran", email: "kamran@test.local", subject: "Toy üçün avtobus", message: "Salam, 20 dekabr üçün 50 yerlik avtobus lazımdır." };
    const res = await request(app).post("/api/contact").send(msg);
    expect(res.status).toBe(201);
    expect((await request(app).post("/api/contact").send({ ...msg, message: "qısa" })).status).toBe(400);
    expect((await request(app).post("/api/contact").send({ ...msg, website: "spam.example" })).status).toBe(400);

    const adm = { Authorization: `Bearer ${admin}` };
    expect((await request(app).get("/api/admin/messages")).status).toBe(401);
    const list = (await request(app).get("/api/admin/messages?status=new").set(adm)).body;
    expect(list).toHaveLength(1);
    const read = await request(app).patch(`/api/admin/messages/${list[0].id}`).set(adm).send({ status: "read" });
    expect(read.body.status).toBe("read");
    expect((await request(app).delete(`/api/admin/messages/${list[0].id}`).set(adm)).status).toBe(204);
  });
});

describe("demo admin (public, read-only)", () => {
  it("is seeded, can read every admin list, cannot write, and sees no personal data", async () => {
    await request(app).post("/api/contact").send({ name: "Nigar Quliyeva", email: "nigar@test.local", phone: "+994 50 123 45 67", message: "Salam, həftə sonu üçün maşın lazımdır." });
    const login = await request(app).post("/api/auth/login").send({ email: "admin@afn.demo", password: "demo12345" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("demo");
    const demo = { Authorization: `Bearer ${login.body.token}` };

    for (const path of ["/api/admin/stats", "/api/admin/bookings", "/api/admin/messages", "/api/admin/locations", "/api/admin/reviews"]) {
      expect((await request(app).get(path).set(demo)).status).toBe(200);
    }
    const msgs = (await request(app).get("/api/admin/messages").set(demo)).body;
    const nigar = msgs.find((m: { email: string }) => m.email.endsWith("@test.local"));
    expect(nigar.name).toBe("N*** Q***");
    expect(nigar.email).toBe("n***@test.local");
    expect(nigar.phone).toBe("+*** ** *** ** 67");
    expect(nigar.message).not.toMatch(/həftə/);

    const cars = (await request(app).get("/api/cars")).body;
    const writes = [
      request(app).post("/api/cars").set(demo).send({}),
      request(app).put(`/api/cars/${cars[0].id}`).set(demo).send({ pricePerDay: 1 }),
      request(app).delete(`/api/cars/${cars[0].id}`).set(demo),
      request(app).patch(`/api/admin/messages/${nigar.id}`).set(demo).send({ status: "read" }),
      request(app).delete(`/api/admin/messages/${nigar.id}`).set(demo),
      request(app).post("/api/locations").set(demo).send({}),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Demo rejim/);
    }
    expect((await request(app).get(`/api/cars/${cars[0].id}`)).body.pricePerDay).toBe(cars[0].pricePerDay);
    // a demo token is not a customer token either
    expect((await request(app).get("/api/bookings/mine").set(demo)).status).toBe(403);
    // the real admin still has full rights and sees the real data
    const real = (await request(app).get("/api/admin/messages").set({ Authorization: `Bearer ${admin}` })).body;
    expect(real.some((m: { name: string }) => m.name === "Nigar Quliyeva")).toBe(true);
  });
});
