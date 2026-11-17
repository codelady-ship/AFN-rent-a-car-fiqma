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
