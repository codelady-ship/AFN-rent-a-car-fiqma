// Fills empty collections with the AFN demo data (src/data/rentAcar.json) and makes sure the admin account
// and the public read-only demo admin (admin@afn.demo / demo12345, role "demo"; DEMO_ADMIN=off removes it) exist.
// Usage: npm run seed            -> inserts only into empty collections
//        npm run seed -- --reset -> wipes slides, categories, cars, locations and demo reviews first (bookings are kept)
import mongoose, { type Model } from "mongoose";
import { DESCRIPTIONS, FEATURED, LOCATIONS, REVIEWS } from "./data/demo";
import data from "./data/rentAcar.json";
import { ensureAdmin, ensureDemoAdmin } from "./lib/auth";
import { config } from "./lib/config";
import { connect } from "./lib/db";
import { Car, CategoryModel, Location, Review, Slide, ensureIndexes } from "./models";

export async function seed({ reset = false } = {}) {
  await ensureIndexes();
  if (reset) {
    await Promise.all([Slide, CategoryModel, Car, Location].map((m) => (m as Model<unknown>).deleteMany({})));
    await Review.deleteMany({ user: { $exists: false } });
  }
  const out: Record<string, string | number> = {};
  const fill = async (M: Model<any>, rows: object[], key: string) => {
    if (await M.estimatedDocumentCount()) return void (out[key] = "skipped (not empty)");
    await M.insertMany(rows);
    out[key] = rows.length;
  };
  await fill(Slide, data.slides.map(({ id: _id, ...s }, i) => ({ ...s, order: i })), "slides");
  await fill(CategoryModel, data.categories.map(({ name }, i) => ({ name, order: i })), "categories");
  await fill(
    Car,
    data.cars.map(({ id: _id, ...c }, i) => ({ ...c, order: i, featured: FEATURED.includes(c.model), description: DESCRIPTIONS[c.category] ?? "" })),
    "cars"
  );
  await fill(Location, LOCATIONS.map((l, i) => ({ ...l, order: i })), "locations");
  if (!(await Review.estimatedDocumentCount())) {
    const cars = await Car.find({ model: { $in: REVIEWS.map((r) => r[0]) } });
    const rows = REVIEWS.flatMap(([model, authorName, rating, comment]) => {
      const car = cars.find((c) => c.model === model);
      return car ? [{ car: car._id, authorName, rating, comment }] : [];
    });
    await Review.insertMany(rows);
    out.reviews = rows.length;
  } else out.reviews = "skipped (not empty)";
  out.admin = await ensureAdmin();
  out.demoAdmin = await ensureDemoAdmin();
  return out;
}

if (require.main === module) {
  connect(config.mongoUri)
    .then(() => seed({ reset: process.argv.includes("--reset") }))
    .then((out) => console.log("Seed done:", out))
    .catch((err) => {
      console.error("Seed failed:", err.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
