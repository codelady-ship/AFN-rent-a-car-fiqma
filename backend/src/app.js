const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const { z } = require("zod");
const { createBaseApp, publicWriteLimiter } = require("./lib/base");
const { requireAdmin } = require("./lib/auth");
const { HttpError, validate, notFound, errorHandler } = require("./lib/errors");
const { CATEGORIES, PLACES, Slide, Category, Car, Reservation, CarDay } = require("./models");

// Round-trip check: Date.parse("2027-02-30") rolls over to 2 March, so compare the
// normalised date with the input to reject impossible calendar dates.
const isRealDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine(isRealDate, "Belə tarix yoxdur.");
// Booked days: from the pick-up day up to (not including) the return day.
const bookedDays = (from, count) =>
  Array.from({ length: count }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
const isDuplicateKey = (err) => err && (err.code === 11000 || (err.writeErrors || []).some((w) => (w.code || w.err?.code) === 11000));
const CLASH_MESSAGE = "Bu tarixlərdə avtomobil artıq rezerv olunub. Başqa tarix seçin.";

// Claims every booked day of a car for one reservation reference. All or nothing:
// on a clash the days already inserted for this reference are removed again.
async function claimDays(carId, from, days, reference) {
  try {
    await CarDay.insertMany(bookedDays(from, days).map((day) => ({ car: carId, day, reference })), { ordered: true });
  } catch (err) {
    await CarDay.deleteMany({ reference });
    if (isDuplicateKey(err)) throw new HttpError(409, CLASH_MESSAGE);
    throw err;
  }
}
const todayInBaku = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const objectId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Not found");
  return id;
};

const carSchema = z.object({
  model: z.string().trim().min(2).max(80),
  brand: z.string().trim().min(2).max(40),
  year: z.coerce.number().int().min(1990).max(2100),
  category: z.enum(CATEGORIES),
  fuelType: z.string().trim().min(2).max(30),
  transmission: z.string().trim().min(2).max(30),
  engine: z.string().trim().min(1).max(10),
  seats: z.coerce.number().int().min(1).max(60),
  color: z.string().trim().max(30).optional(),
  pricePerDay: z.coerce.number().positive().max(10000),
  available: z.boolean().optional(),
  image: z.string().trim().min(1).max(300),
  order: z.coerce.number().int().optional(),
});

const reservationSchema = z
  .object({
    name: z.string().trim().min(3, "Ad və soyadı yazın (ən azı 3 hərf).").max(80),
    phone: z.string().trim().regex(/^[+]?[0-9 ()-]{9,20}$/, "Telefon nömrəsini düzgün yazın."),
    car: z.string().trim().min(1, "Avtomobil seçin."),
    from: isoDate,
    to: isoDate,
    place: z.enum(PLACES).default(PLACES[0]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine((r) => dayDiff(r.from, r.to) >= 1, { path: ["to"], message: "Qaytarma tarixi götürmə tarixindən sonra olmalıdır." })
  .refine((r) => dayDiff(r.from, r.to) <= 60, { path: ["to"], message: "Ən çox 60 günlük rezervasiya etmək olar." });

const statusSchema = z.object({ status: z.enum(["pending", "confirmed", "cancelled"]) });

function createApp() {
  const app = createBaseApp();
  const api = express.Router();

  /* ----- Public catalogue ----- */
  api.get("/slides", async (_req, res) => {
    res.json(await Slide.find().sort({ order: 1, createdAt: 1 }));
  });

  api.get("/categories", async (_req, res) => {
    res.json(await Category.find().sort({ order: 1, createdAt: 1 }));
  });

  api.get("/cars", async (req, res) => {
    const filter = {};
    if (req.query.category && req.query.category !== "Hamısı") filter.category = String(req.query.category);
    if (req.query.available === "true") filter.available = true;
    res.json(await Car.find(filter).sort({ order: 1, createdAt: 1 }));
  });

  api.get("/cars/:id", async (req, res) => {
    const car = await Car.findById(objectId(req.params.id));
    if (!car) throw new HttpError(404, "Car not found");
    res.json(car);
  });

  /* ----- Public reservation request ----- */
  api.post("/reservations", publicWriteLimiter(), validate(reservationSchema), async (req, res) => {
    const r = req.body;
    if (r.from < todayInBaku()) throw new HttpError(400, "Validation failed", [{ field: "from", message: "Keçmiş tarix seçmək olmaz." }]);
    if (!mongoose.isValidObjectId(r.car)) throw new HttpError(400, "Validation failed", [{ field: "car", message: "Avtomobil tapılmadı." }]);
    const car = await Car.findById(r.car);
    if (!car) throw new HttpError(400, "Validation failed", [{ field: "car", message: "Avtomobil tapılmadı." }]);
    if (!car.available) throw new HttpError(409, "Bu avtomobil hazırda icarədədir.");
    const days = dayDiff(r.from, r.to);
    let doc;
    // The unique {car, day} index decides who gets the car (parallel-safe). A reference
    // collision (3 random bytes) is retried with a new reference.
    for (let attempt = 0; !doc; attempt++) {
      const reference = "AFN-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      await claimDays(car._id, r.from, days, reference);
      try {
        doc = await Reservation.create({ ...r, reference, car: car._id, carModel: car.model, days, pricePerDay: car.pricePerDay, total: days * car.pricePerDay });
      } catch (err) {
        await CarDay.deleteMany({ reference });
        if (!isDuplicateKey(err) || attempt >= 2) throw err;
      }
    }
    res.status(201).json({ reference: doc.reference, carModel: doc.carModel, from: doc.from, to: doc.to, days, total: doc.total, place: doc.place, status: doc.status });
  });

  /* ----- Admin (JWT) ----- */
  api.post("/cars", requireAdmin, validate(carSchema), async (req, res) => {
    res.status(201).json(await Car.create(req.body));
  });

  api.put("/cars/:id", requireAdmin, validate(carSchema.partial()), async (req, res) => {
    const car = await Car.findByIdAndUpdate(objectId(req.params.id), req.body, { new: true, runValidators: true });
    if (!car) throw new HttpError(404, "Car not found");
    res.json(car);
  });

  api.delete("/cars/:id", requireAdmin, async (req, res) => {
    const car = await Car.findByIdAndDelete(objectId(req.params.id));
    if (!car) throw new HttpError(404, "Car not found");
    res.status(204).end();
  });

  api.get("/reservations", requireAdmin, async (req, res) => {
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    res.json(await Reservation.find(filter).sort({ createdAt: -1 }).limit(200));
  });

  api.patch("/reservations/:id", requireAdmin, validate(statusSchema), async (req, res) => {
    const doc = await Reservation.findById(objectId(req.params.id));
    if (!doc) throw new HttpError(404, "Reservation not found");
    const next = req.body.status;
    if (next === "cancelled" && doc.status !== "cancelled") {
      await CarDay.deleteMany({ reference: doc.reference }); // free the days for other customers
    } else if (next !== "cancelled" && doc.status === "cancelled") {
      await claimDays(doc.car, doc.from, doc.days, doc.reference); // 409 if someone booked them meanwhile
    }
    doc.status = next;
    await doc.save();
    res.json(doc);
  });

  app.use("/api", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
