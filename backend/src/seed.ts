// Fills empty collections with the AFN demo data (src/data/rentAcar.json) and makes sure the admin account exists.
// Usage: npm run seed            -> inserts only into empty collections
//        npm run seed -- --reset -> wipes slides, categories, cars, locations and demo reviews first (bookings are kept)
import mongoose, { type Model } from "mongoose";
import data from "./data/rentAcar.json";
import { ensureAdmin } from "./lib/auth";
import { config } from "./lib/config";
import { connect } from "./lib/db";
import { Car, CategoryModel, Location, Review, Slide, ensureIndexes } from "./models";

const LOCATIONS = [
  { name: "Ofis – Xocalı pr. 13", address: "Bakı, Xocalı prospekti 13", type: "office", deliveryFee: 0, hours: "Hər gün 09:00–21:00" },
  { name: "Heydər Əliyev Beynəlxalq Hava Limanı", address: "Bakı, Hava limanı, gəliş zalı", type: "airport", deliveryFee: 20, hours: "7/24" },
  { name: "Ünvana çatdırılma (Bakı daxilində)", address: "Bakı şəhəri daxilində istənilən ünvan", type: "delivery", deliveryFee: 15, hours: "09:00–23:00" },
] as const;

const DESCRIPTIONS: Record<string, string> = {
  Ekonom: "Şəhər daxilində gündəlik sürüş üçün qənaətcil və rahat seçim.",
  Biznes: "Görüşlərə və hava limanı transferlərinə uyğun, geniş və sakit salon.",
  Premium: "Xüsusi günlər və uzun yollar üçün yüksək komfort və güc.",
  "Krossover və SUV": "Ailə səfərləri və bölgələr üçün hündür klirens və geniş baqaj.",
  Avtobuslar: "Qrup turları, toylar və korporativ tədbirlər üçün sürücü ilə.",
};

const FEATURED = new Set(["Toyota Camry", "Hyundai Tucson", "Toyota Land Cruiser Prado"]);

const REVIEWS: [string, string, number, string][] = [
  ["Toyota Camry", "Elvin M.", 5, "Avtomobil təmiz və tam bak idi, hava limanında vaxtında təhvil verdilər."],
  ["Hyundai Tucson", "Nigar Ə.", 5, "Qəbələ səfəri üçün götürdük, çox rahat idi. Uşaq oturacağı da hazır idi."],
  ["Hyundai Accent", "Rauf H.", 4, "Qiymətinə görə əla seçimdir, şəhərdə yanacağa qənaət edir."],
  ["Toyota Land Cruiser Prado", "Samirə Q.", 5, "Bölgə yolları üçün ideal idi. Menecer bütün suallara cavab verdi."],
];

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
    data.cars.map(({ id: _id, ...c }, i) => ({ ...c, order: i, featured: FEATURED.has(c.model), description: DESCRIPTIONS[c.category] ?? "" })),
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
