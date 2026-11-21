import mongoose, { Schema } from "mongoose";
import { BOOKING_STATUSES, CATEGORIES } from "../catalog";
import { jsonOpts } from "../lib/json";

const opts = { timestamps: true, toJSON: jsonOpts };

const slideSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: "" },
    price: { type: String, trim: true, default: "" },
    image: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    order: { type: Number, default: 0 },
  },
  opts
);

const categorySchema = new Schema(
  { name: { type: String, required: true, unique: true, trim: true }, order: { type: Number, default: 0 } },
  opts
);

const carSchema = new Schema(
  {
    model: { type: String, required: true, trim: true, maxlength: 80 },
    brand: { type: String, required: true, trim: true, maxlength: 40 },
    year: { type: Number, required: true, min: 1990, max: 2100 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    fuelType: { type: String, required: true, trim: true },
    transmission: { type: String, required: true, trim: true },
    engine: { type: String, required: true, trim: true },
    seats: { type: Number, required: true, min: 1, max: 60 },
    color: { type: String, trim: true, default: "" },
    pricePerDay: { type: Number, required: true, min: 1 },
    available: { type: Boolean, default: true },
    image: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  opts
);

const locationSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 160, default: "" },
    type: { type: String, enum: ["office", "airport", "delivery"], required: true },
    deliveryFee: { type: Number, min: 0, default: 0 },
    hours: { type: String, trim: true, maxlength: 60, default: "" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  opts
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin", "demo"], default: "customer" },
  },
  {
    timestamps: true,
    toJSON: {
      ...jsonOpts,
      transform(_doc: unknown, ret: Record<string, unknown>) {
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

const extraLineSchema = new Schema(
  { key: String, name: String, pricePerDay: Number, total: Number },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    carModel: { type: String, required: true },
    from: { type: String, required: true }, // YYYY-MM-DD, pick-up day
    to: { type: String, required: true }, // YYYY-MM-DD, return day (not billed)
    days: { type: Number, required: true, min: 1 },
    pricePerDay: { type: Number, required: true },
    carTotal: { type: Number, required: true },
    extras: { type: [extraLineSchema], default: [] },
    extrasTotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    location: { type: Schema.Types.ObjectId, ref: "Location" },
    place: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending", index: true },
  },
  opts
);

/**
 * One document per car per busy day. The unique index makes double booking impossible,
 * even for two requests that arrive at the same moment: the second insert fails with E11000.
 */
const bookingSlotSchema = new Schema({
  car: { type: Schema.Types.ObjectId, ref: "Car", required: true },
  day: { type: String, required: true },
  booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
});
bookingSlotSchema.index({ car: 1, day: 1 }, { unique: true });

const reviewSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  opts
);
// One review per customer per car (seeded demo reviews have no user and are not limited).
reviewSchema.index({ car: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });

const messageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    subject: { type: String, trim: true, maxlength: 120, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["new", "read", "archived"], default: "new", index: true },
  },
  opts
);

export const Slide = mongoose.model("Slide", slideSchema);
export const CategoryModel = mongoose.model("Category", categorySchema);
export const Car = mongoose.model("Car", carSchema);
export const Location = mongoose.model("Location", locationSchema);
export const User = mongoose.model("User", userSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
export const BookingSlot = mongoose.model("BookingSlot", bookingSlotSchema);
export const Review = mongoose.model("Review", reviewSchema);
export const Message = mongoose.model("Message", messageSchema);

/** Builds every index (above all the unique booking-slot index) before the API takes requests. */
export const ensureIndexes = () =>
  Promise.all([Car, Location, User, Booking, BookingSlot, Review, CategoryModel, Message, Slide].map((m) => m.init()));
