import { Router, type RequestHandler } from "express";
import mongoose from "mongoose";
import { isDemo, maskPerson, requireAdmin } from "../lib/auth";
import { HttpError, validate } from "../lib/errors";
import { publicWriteLimiter } from "../lib/limits";
import { Booking, BookingSlot, Car, Location, Message, Review, User } from "../models";
import { carSchema, locationSchema, messageSchema, messageStatusSchema, statusSchema } from "../schemas";
import { setStatus } from "../services/bookings";

export const admin = Router();

const oid = (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Not found");
  return id;
};

/* ----- Contact form (public) ----- */
admin.post("/contact", publicWriteLimiter(), validate(messageSchema), async (req, res) => {
  const { website: _hp, ...data } = req.body;
  const msg = await Message.create(data);
  res.status(201).json({ id: msg.id, status: "received" });
});

/* ----- Cars (admin) ----- */
admin.post("/cars", requireAdmin, validate(carSchema), async (req, res) => {
  res.status(201).json(await Car.create(req.body));
});

admin.put("/cars/:id", requireAdmin, validate(carSchema.partial()), async (req, res) => {
  const car = await Car.findByIdAndUpdate(oid(String(req.params.id)), req.body, { new: true, runValidators: true });
  if (!car) throw new HttpError(404, "Car not found");
  res.json(car);
});

admin.delete("/cars/:id", requireAdmin, async (req, res) => {
  const id = oid(String(req.params.id));
  const open = await Booking.exists({ car: id, status: { $in: ["pending", "confirmed"] } });
  if (open) throw new HttpError(409, "Bu avtomobilin aktiv rezervasiyaları var; əvvəlcə onları bağlayın və ya avtomobili 'mövcud deyil' edin.");
  const car = await Car.findByIdAndDelete(id);
  if (!car) throw new HttpError(404, "Car not found");
  res.status(204).end();
});

/* ----- Locations (admin) ----- */
admin.get("/admin/locations", requireAdmin, async (_req, res) => {
  res.json(await Location.find().sort({ order: 1, createdAt: 1 }));
});
admin.post("/locations", requireAdmin, validate(locationSchema), async (req, res) => {
  res.status(201).json(await Location.create(req.body));
});
admin.put("/locations/:id", requireAdmin, validate(locationSchema.partial()), async (req, res) => {
  const loc = await Location.findByIdAndUpdate(oid(String(req.params.id)), req.body, { new: true, runValidators: true });
  if (!loc) throw new HttpError(404, "Location not found");
  res.json(loc);
});
admin.delete("/locations/:id", requireAdmin, async (req, res) => {
  const loc = await Location.findByIdAndDelete(oid(String(req.params.id)));
  if (!loc) throw new HttpError(404, "Location not found");
  res.status(204).end();
});

/* ----- Bookings (admin) ----- */
const listBookings: RequestHandler = async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const filter = status && ["pending", "confirmed", "completed", "cancelled"].includes(status) ? { status } : {};
  const rows = await Booking.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(isDemo(req) ? rows.map((r) => maskPerson(r.toJSON())) : rows);
};
const patchBooking: RequestHandler = async (req, res) => {
  res.json(await setStatus(String(req.params.id), req.body.status));
};
admin.get("/admin/bookings", requireAdmin, listBookings);
admin.patch("/admin/bookings/:id", requireAdmin, validate(statusSchema), patchBooking);
// Same endpoints under the names the first API version used.
admin.get("/reservations", requireAdmin, listBookings);
admin.patch("/reservations/:id", requireAdmin, validate(statusSchema), patchBooking);

/* ----- Messages (admin) ----- */
admin.get("/admin/messages", requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const filter = status && ["new", "read", "archived"].includes(status) ? { status } : {};
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(isDemo(req) ? rows.map((r) => maskPerson(r.toJSON())) : rows);
});
admin.patch("/admin/messages/:id", requireAdmin, validate(messageStatusSchema), async (req, res) => {
  const msg = await Message.findByIdAndUpdate(oid(String(req.params.id)), { status: req.body.status }, { new: true });
  if (!msg) throw new HttpError(404, "Message not found");
  res.json(msg);
});
admin.delete("/admin/messages/:id", requireAdmin, async (req, res) => {
  const msg = await Message.findByIdAndDelete(oid(String(req.params.id)));
  if (!msg) throw new HttpError(404, "Message not found");
  res.status(204).end();
});

/* ----- Reviews (admin moderation) ----- */
admin.get("/admin/reviews", requireAdmin, async (_req, res) => {
  res.json(await Review.find().sort({ createdAt: -1 }).limit(200).populate("car", "model"));
});
admin.delete("/admin/reviews/:id", requireAdmin, async (req, res) => {
  const r = await Review.findByIdAndDelete(oid(String(req.params.id)));
  if (!r) throw new HttpError(404, "Review not found");
  res.status(204).end();
});

/* ----- Dashboard numbers ----- */
admin.get("/admin/stats", requireAdmin, async (_req, res) => {
  const [cars, customers, newMessages, byStatus, revenue, busySlots] = await Promise.all([
    Car.countDocuments(),
    User.countDocuments({ role: "customer" }),
    Message.countDocuments({ status: "new" }),
    Booking.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Booking.aggregate<{ total: number }>([
      { $match: { status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    BookingSlot.estimatedDocumentCount(),
  ]);
  const bookings = Object.fromEntries(["pending", "confirmed", "completed", "cancelled"].map((s) => [s, byStatus.find((b) => b._id === s)?.n ?? 0]));
  res.json({ cars, customers, newMessages, bookings, revenue: revenue[0]?.total ?? 0, bookedDays: busySlots });
});
