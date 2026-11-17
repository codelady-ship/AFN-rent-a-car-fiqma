import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import { EXTRAS, MAX_RENTAL_DAYS, TRANSITIONS, type BookingStatus, type ExtraKey } from "../catalog";
import { dayDiff, daysBetween, todayInBaku } from "../lib/dates";
import { HttpError, fieldError } from "../lib/errors";
import { Booking, BookingSlot, Car, Location } from "../models";

export type QuoteInput = {
  car: string;
  from: string;
  to: string;
  extras?: ExtraKey[];
  location?: string; // Location id
  place?: string; // Location name (older clients send the name)
};

export type BookingInput = QuoteInput & { name: string; phone: string; email?: string; note?: string };

const isDup = (err: unknown) => !!err && typeof err === "object" && (err as { code?: number }).code === 11000;

/** Checks the dates and the car and computes the price. Nothing the client sends about money is trusted. */
export async function quote(input: QuoteInput) {
  const { from, to } = input;
  if (from < todayInBaku()) throw fieldError("from", "Keçmiş tarix seçmək olmaz.");
  const days = dayDiff(from, to);
  if (days < 1) throw fieldError("to", "Qaytarma tarixi götürmə tarixindən sonra olmalıdır.");
  if (days > MAX_RENTAL_DAYS) throw fieldError("to", `Ən çox ${MAX_RENTAL_DAYS} günlük rezervasiya etmək olar.`);

  if (!mongoose.isValidObjectId(input.car)) throw fieldError("car", "Avtomobil tapılmadı.");
  const car = await Car.findById(input.car);
  if (!car) throw fieldError("car", "Avtomobil tapılmadı.");
  if (!car.available) throw new HttpError(409, "Bu avtomobil hazırda icarədədir.");

  let location = null;
  if (input.location) {
    location = mongoose.isValidObjectId(input.location) ? await Location.findById(input.location) : null;
  } else {
    location = input.place
      ? await Location.findOne({ name: input.place })
      : await Location.findOne({ active: true }).sort({ order: 1 });
  }
  if (!location || !location.active) throw fieldError("location", "Götürmə yerini seçin.");

  const keys = [...new Set(input.extras ?? [])];
  const extras = keys.map((k) => {
    const e = EXTRAS.find((x) => x.key === k)!;
    return { key: e.key, name: e.name, pricePerDay: e.pricePerDay, total: e.pricePerDay * days };
  });
  const carTotal = car.pricePerDay * days;
  const extrasTotal = extras.reduce((s, e) => s + e.total, 0);
  const deliveryFee = location.deliveryFee || 0;
  return {
    car,
    location,
    days,
    pricePerDay: car.pricePerDay,
    carTotal,
    extras,
    extrasTotal,
    deliveryFee,
    total: carTotal + extrasTotal + deliveryFee,
  };
}

/**
 * Creates a booking without a check-then-insert race: it first claims one BookingSlot per busy day.
 * The unique (car, day) index lets only one request claim a day; the loser gets 409 and its partial
 * claims are removed.
 */
export async function createBooking(input: BookingInput, userId?: string) {
  const q = await quote(input);
  const bookingId = new Types.ObjectId();
  const slots = daysBetween(input.from, input.to).map((day) => ({ car: q.car._id, day, booking: bookingId }));
  try {
    await BookingSlot.insertMany(slots, { ordered: true });
  } catch (err) {
    await BookingSlot.deleteMany({ booking: bookingId });
    if (isDup(err)) throw new HttpError(409, "Bu tarixlərdə avtomobil artıq rezerv olunub. Başqa tarix seçin.");
    throw err;
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await Booking.create({
          _id: bookingId,
          reference: "AFN-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
          user: userId,
          name: input.name,
          phone: input.phone,
          email: input.email ?? "",
          note: input.note ?? "",
          car: q.car._id,
          carModel: q.car.model,
          from: input.from,
          to: input.to,
          days: q.days,
          pricePerDay: q.pricePerDay,
          carTotal: q.carTotal,
          extras: q.extras,
          extrasTotal: q.extrasTotal,
          deliveryFee: q.deliveryFee,
          total: q.total,
          location: q.location._id,
          place: q.location.name,
        });
      } catch (err) {
        if (!isDup(err) || attempt >= 3) throw err; // reference collision: try a new one
      }
    }
  } catch (err) {
    await BookingSlot.deleteMany({ booking: bookingId });
    throw err;
  }
}

/** Applies a status change if the flow allows it; cancelling frees the car's days. */
export async function setStatus(id: string, next: BookingStatus) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "Booking not found");
  const booking = await Booking.findById(id);
  if (!booking) throw new HttpError(404, "Booking not found");
  const current = booking.status as BookingStatus;
  if (current === next) return booking;
  if (!TRANSITIONS[current].includes(next)) {
    throw new HttpError(409, `Status cannot change from ${current} to ${next}`);
  }
  // Conditional update: a parallel change of the same booking cannot apply twice.
  const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: current }, { status: next }, { new: true });
  if (!updated) throw new HttpError(409, "Booking was changed by someone else, reload and try again");
  if (next === "cancelled") await BookingSlot.deleteMany({ booking: booking._id });
  return updated;
}

/** Days (YYYY-MM-DD) on which a car is already taken, from today on. */
export async function busyDays(carId: Types.ObjectId | string) {
  const rows = await BookingSlot.find({ car: carId, day: { $gte: todayInBaku() } })
    .sort({ day: 1 })
    .limit(400)
    .select("day -_id")
    .lean();
  return rows.map((r) => r.day);
}

/** Car ids with at least one busy day in [from, to). */
export const carsBusyBetween = (from: string, to: string) =>
  BookingSlot.distinct("car", { day: { $gte: from, $lt: to } });
