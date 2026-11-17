const mongoose = require("mongoose");
const { jsonOpts } = require("./lib/base");

const CATEGORIES = ["Ekonom", "Biznes", "Premium", "Krossover və SUV", "Avtobuslar"];
const PLACES = ["Ofis – Xocalı pr. 13", "Heydər Əliyev Beynəlxalq Hava Limanı", "Ünvana çatdırılma (Bakı daxilində)"];

const opts = { timestamps: true, toJSON: jsonOpts };

const slideSchema = new mongoose.Schema(
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

const categorySchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true }, order: { type: Number, default: 0 } },
  opts
);

const carSchema = new mongoose.Schema(
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
    order: { type: Number, default: 0 },
  },
  opts
);

const reservationSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    carModel: { type: String, required: true },
    from: { type: String, required: true }, // YYYY-MM-DD
    to: { type: String, required: true },
    days: { type: Number, required: true, min: 1 },
    pricePerDay: { type: Number, required: true },
    total: { type: Number, required: true },
    place: { type: String, enum: PLACES, required: true },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },
  },
  opts
);

module.exports = {
  CATEGORIES,
  PLACES,
  Slide: mongoose.model("Slide", slideSchema),
  Category: mongoose.model("Category", categorySchema),
  Car: mongoose.model("Car", carSchema),
  Reservation: mongoose.model("Reservation", reservationSchema),
};
