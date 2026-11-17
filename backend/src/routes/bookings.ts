import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../lib/auth";
import { todayInBaku } from "../lib/dates";
import { HttpError, validate } from "../lib/errors";
import { publicWriteLimiter } from "../lib/limits";
import { Booking } from "../models";
import { bookingSchema, quoteSchema } from "../schemas";
import { createBooking, quote, setStatus } from "../services/bookings";

export const bookings = Router();

type Created = Awaited<ReturnType<typeof createBooking>>;
const receipt = (b: Created) => ({
  id: b.id,
  reference: b.reference,
  carModel: b.carModel,
  from: b.from,
  to: b.to,
  days: b.days,
  pricePerDay: b.pricePerDay,
  carTotal: b.carTotal,
  extras: b.extras,
  extrasTotal: b.extrasTotal,
  deliveryFee: b.deliveryFee,
  total: b.total,
  place: b.place,
  status: b.status,
});

/** Price breakdown for the booking form; computed on the server only. */
bookings.post("/bookings/quote", validate(quoteSchema), async (req, res) => {
  const q = await quote(req.body);
  res.json({
    car: q.car.id,
    carModel: q.car.model,
    location: q.location.id,
    place: q.location.name,
    days: q.days,
    pricePerDay: q.pricePerDay,
    carTotal: q.carTotal,
    extras: q.extras,
    extrasTotal: q.extrasTotal,
    deliveryFee: q.deliveryFee,
    total: q.total,
  });
});

/** Guest reservation request (no account): name + phone. Kept for the original site's form. */
bookings.post("/reservations", publicWriteLimiter(), validate(bookingSchema), async (req, res) => {
  res.status(201).json(receipt(await createBooking(req.body)));
});

/** Booking by a signed-in customer; it shows up in "My bookings". */
bookings.post("/bookings", publicWriteLimiter(), requireAuth("customer"), validate(bookingSchema), async (req, res) => {
  res.status(201).json(receipt(await createBooking(req.body, req.user!.id)));
});

bookings.get("/bookings/mine", requireAuth("customer"), async (req, res) => {
  res.json(await Booking.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(100));
});

/** A customer can cancel only their own booking, and only before the pick-up day. */
bookings.patch("/bookings/:id/cancel", requireAuth("customer"), async (req, res) => {
  const id = String(req.params.id);
  const own = mongoose.isValidObjectId(id) ? await Booking.findOne({ _id: id, user: req.user!.id }) : null;
  if (!own) throw new HttpError(404, "Booking not found");
  if (own.from <= todayInBaku()) throw new HttpError(409, "Götürmə günü gəlib çatıb; ləğv üçün bizə zəng edin.");
  res.json(await setStatus(id, "cancelled"));
});
