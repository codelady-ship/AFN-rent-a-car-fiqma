// API tests on an in-memory MongoDB. Run: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.PUBLIC_RATE_LIMIT = "200";

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server-core");
const { createApp } = require("../src/app");
const { seed } = require("../src/seed");
const { ensureIndexes } = require("../src/lib/db");

let mongo;
let app;
let token;
const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("afn-test"));
  await ensureIndexes();
  await seed();
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test("health and seeded catalogue", async () => {
  assert.equal((await request(app).get("/api/health")).body.ok, true);
  assert.equal((await request(app).get("/api/slides")).body.length, 4);
  const cats = await request(app).get("/api/categories");
  assert.equal(cats.body[0].name, "Hamısı");
  const cars = await request(app).get("/api/cars");
  assert.equal(cars.body.length, 13);
  assert.ok(cars.body[0].id && !cars.body[0]._id);
  const eco = await request(app).get("/api/cars?category=Ekonom");
  assert.ok(eco.body.length > 0 && eco.body.every((c) => c.category === "Ekonom"));
});

test("car by id: 200, bad id 404", async () => {
  const [car] = (await request(app).get("/api/cars")).body;
  assert.equal((await request(app).get(`/api/cars/${car.id}`)).body.model, car.model);
  assert.equal((await request(app).get("/api/cars/nope")).status, 404);
  assert.equal((await request(app).get("/api/cars/64b7f0f0f0f0f0f0f0f0f0f0")).status, 404);
});

test("reservation: valid request gets a reference and server-side total", async () => {
  const car = (await request(app).get("/api/cars?available=true")).body[0];
  const res = await request(app)
    .post("/api/reservations")
    .send({ name: "Test Müştəri", phone: "+994 50 000 00 00", car: car.id, from: isoIn(3), to: isoIn(6) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.reference, /^AFN-[0-9A-F]{6}$/);
  assert.equal(res.body.days, 3);
  assert.equal(res.body.total, 3 * car.pricePerDay);

  const clash = await request(app)
    .post("/api/reservations")
    .send({ name: "Başqa Müştəri", phone: "+994 55 111 11 11", car: car.id, from: isoIn(4), to: isoIn(8) });
  assert.equal(clash.status, 409);
});

test("reservation: validation errors", async () => {
  const car = (await request(app).get("/api/cars?available=true")).body[1];
  const bad = await request(app).post("/api/reservations").send({ name: "A", phone: "12", car: car.id, from: isoIn(5), to: isoIn(5) });
  assert.equal(bad.status, 400);
  const fields = bad.body.details.map((d) => d.field);
  assert.ok(fields.includes("name") && fields.includes("phone"));

  const past = await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2020-01-01", to: "2020-01-03" });
  assert.equal(past.status, 400);

  const busy = (await request(app).get("/api/cars")).body.find((c) => !c.available);
  if (busy) {
    const r = await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: busy.id, from: isoIn(1), to: isoIn(2) });
    assert.equal(r.status, 409);
  }
  assert.equal((await request(app).post("/api/reservations").set("Content-Type", "application/json").send("{bad")).status, 400);
});

test("admin: login required, wrong password rejected", async () => {
  assert.equal((await request(app).get("/api/reservations")).status, 401);
  assert.equal((await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "wrong" })).status, 401);
  const ok = await request(app).post("/api/auth/login").send({ email: "admin@test.local", password: "test-password" });
  assert.equal(ok.status, 200);
  token = ok.body.token;
});

test("admin: car CRUD and reservation status", async () => {
  const auth = { Authorization: `Bearer ${token}` };
  const body = { model: "Kia Rio", brand: "Kia", year: 2022, category: "Ekonom", fuelType: "Benzin", transmission: "Avtomatik", engine: "1.4", seats: 5, pricePerDay: 45, image: "./fotos/cars/kia-rio.webp" };
  const created = await request(app).post("/api/cars").set(auth).send(body);
  assert.equal(created.status, 201);
  assert.equal((await request(app).post("/api/cars").set(auth).send({ ...body, category: "Yox" })).status, 400);
  const upd = await request(app).put(`/api/cars/${created.body.id}`).set(auth).send({ pricePerDay: 50 });
  assert.equal(upd.body.pricePerDay, 50);
  assert.equal((await request(app).delete(`/api/cars/${created.body.id}`).set(auth)).status, 204);

  const list = await request(app).get("/api/reservations").set(auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 1);
  const patched = await request(app).patch(`/api/reservations/${list.body[0].id}`).set(auth).send({ status: "confirmed" });
  assert.equal(patched.body.status, "confirmed");
});

test("reservation: parallel requests for the same car and dates -> exactly one 201", async () => {
  const car = (await request(app).get("/api/cars?available=true")).body[2];
  const body = (i) => ({ name: "Paralel Müştəri", phone: "+994 50 000 00 0" + i, car: car.id, from: isoIn(20), to: isoIn(24) });
  const statuses = (await Promise.all(Array.from({ length: 8 }, (_, i) => request(app).post("/api/reservations").send(body(i))))).map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 201).length, 1, statuses.join(","));
  assert.equal(statuses.filter((s) => s === 409).length, 7, statuses.join(","));
  // overlapping in parallel from both sides: still one winner
  const a = { ...body(8), from: isoIn(30), to: isoIn(33) };
  const b = { ...body(9), from: isoIn(32), to: isoIn(35) };
  const pair = (await Promise.all([request(app).post("/api/reservations").send(a), request(app).post("/api/reservations").send(b)])).map((r) => r.status);
  assert.deepEqual(pair.sort(), [201, 409]);
  // back-to-back is fine: the return day is free for the next customer
  const next = await request(app).post("/api/reservations").send({ ...body(7), from: isoIn(24), to: isoIn(26) });
  assert.equal(next.status, 201, JSON.stringify(next.body));
});

test("reservation: impossible calendar dates are rejected", async () => {
  const car = (await request(app).get("/api/cars?available=true")).body[3];
  const res = await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2027-02-30", to: "2027-03-05" });
  assert.equal(res.status, 400);
  assert.equal(res.body.details[0].field, "from");
  assert.equal((await request(app).post("/api/reservations").send({ name: "Test Müştəri", phone: "+994500000000", car: car.id, from: "2027-13-01", to: "2027-13-03" })).status, 400);
});

test("admin: cancelling frees the days, re-opening checks them again", async () => {
  const auth = { Authorization: `Bearer ${token}` };
  const car = (await request(app).get("/api/cars?available=true")).body[4];
  const body = { name: "Test Müştəri", phone: "+994500000000", car: car.id, from: isoIn(40), to: isoIn(42) };
  const first = await request(app).post("/api/reservations").send(body);
  assert.equal(first.status, 201);
  const id = (await request(app).get("/api/reservations").set(auth)).body.find((r) => r.reference === first.body.reference).id;
  assert.equal((await request(app).post("/api/reservations").send(body)).status, 409);
  assert.equal((await request(app).patch(`/api/reservations/${id}`).set(auth).send({ status: "cancelled" })).body.status, "cancelled");
  assert.equal((await request(app).post("/api/reservations").send(body)).status, 201); // days are free again
  assert.equal((await request(app).patch(`/api/reservations/${id}`).set(auth).send({ status: "pending" })).status, 409);
});

test("CORS: allowed origin echoed, unknown origin refused", async () => {
  const ok = await request(app).get("/api/cars").set("Origin", "https://codelady-ship.github.io");
  assert.equal(ok.headers["access-control-allow-origin"], "https://codelady-ship.github.io");
  assert.equal((await request(app).get("/api/cars").set("Origin", "https://evil.example")).status, 403);
});
