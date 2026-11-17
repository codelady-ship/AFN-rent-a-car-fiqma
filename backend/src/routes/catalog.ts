import { Router } from "express";
import mongoose, { type FilterQuery } from "mongoose";
import { EXTRAS } from "../catalog";
import { requireAuth } from "../lib/auth";
import { HttpError, validate } from "../lib/errors";
import { Booking, Car, CategoryModel, Location, Review, Slide } from "../models";
import { carQuerySchema, reviewSchema } from "../schemas";
import { busyDays, carsBusyBetween } from "../services/bookings";

export const catalog = Router();

const findCar = async (id: string) => {
  const car = mongoose.isValidObjectId(id) ? await Car.findById(id) : null;
  if (!car) throw new HttpError(404, "Car not found");
  return car;
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

catalog.get("/slides", async (_req, res) => {
  res.json(await Slide.find().sort({ order: 1, createdAt: 1 }));
});

catalog.get("/categories", async (_req, res) => {
  res.json(await CategoryModel.find().sort({ order: 1, createdAt: 1 }));
});

catalog.get("/locations", async (_req, res) => {
  res.json(await Location.find({ active: true }).sort({ order: 1, createdAt: 1 }));
});

catalog.get("/extras", (_req, res) => {
  res.json(EXTRAS);
});

/** Fleet with filters: category, price range, seats (minimum), gearbox, fuel, search, free for a date range. */
catalog.get("/cars", validate(carQuerySchema, "query"), async (_req, res) => {
  const q = res.locals.query as import("zod").infer<typeof carQuerySchema>;
  const filter: FilterQuery<unknown> = {};
  if (q.category && q.category !== "Hamısı") filter.category = q.category;
  if (q.available !== undefined) filter.available = q.available;
  if (q.featured !== undefined) filter.featured = q.featured;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.pricePerDay = { ...(q.minPrice !== undefined && { $gte: q.minPrice }), ...(q.maxPrice !== undefined && { $lte: q.maxPrice }) };
  }
  if (q.seats) filter.seats = { $gte: q.seats };
  if (q.transmission) filter.transmission = q.transmission;
  if (q.fuel) filter.fuelType = q.fuel;
  if (q.q) {
    const re = new RegExp(escapeRe(q.q), "i");
    filter.$or = [{ model: re }, { brand: re }];
  }
  if (q.from && q.to) {
    filter.available = true;
    filter._id = { $nin: await carsBusyBetween(q.from, q.to) };
  }
  const sort: Record<string, 1 | -1> = {};
  if (q.sort) sort[q.sort.replace("-", "") === "price" ? "pricePerDay" : "year"] = q.sort.startsWith("-") ? -1 : 1;
  res.json(await Car.find(filter).sort({ ...sort, order: 1, createdAt: 1 }));
});

catalog.get("/cars/:id", async (req, res) => {
  const car = await findCar(String(req.params.id));
  const [stats] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { car: car._id } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  res.json({ ...car.toJSON(), rating: stats ? { average: Math.round(stats.avg * 10) / 10, count: stats.count } : { average: 0, count: 0 } });
});

/** Busy days, so the date picker can grey them out. */
catalog.get("/cars/:id/busy", async (req, res) => {
  const car = await findCar(String(req.params.id));
  res.json({ car: car.id, days: await busyDays(car._id) });
});

catalog.get("/cars/:id/reviews", async (req, res) => {
  const car = await findCar(String(req.params.id));
  res.json(await Review.find({ car: car._id }).sort({ createdAt: -1 }).limit(50).select("-user"));
});

/** Only a customer with a completed rental of this car may review it, once. */
catalog.post("/cars/:id/reviews", requireAuth("customer"), validate(reviewSchema), async (req, res) => {
  const car = await findCar(String(req.params.id));
  const rented = await Booking.exists({ car: car._id, user: req.user!.id, status: "completed" });
  if (!rented) throw new HttpError(403, "Rəy yazmaq üçün bu avtomobili icarəyə götürüb qaytarmış olmalısınız.");
  const review = await Review.create({ ...req.body, car: car._id, user: req.user!.id, authorName: req.user!.name });
  res.status(201).json(review);
});

