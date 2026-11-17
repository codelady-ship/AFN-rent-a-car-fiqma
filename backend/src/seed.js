// Fills the database from backend/rentAcar.json (the same file the static site falls back to).
// Usage: npm run seed            -> inserts only into empty collections
//        npm run seed -- --reset -> wipes slides, categories and cars first (reservations are kept)
const path = require("path");
const mongoose = require("mongoose");
const config = require("./lib/config");
const { connect } = require("./lib/db");
const { Slide, Category, Car } = require("./models");

const data = require(path.join(__dirname, "..", "rentAcar.json"));

async function seed({ reset = false } = {}) {
  if (reset) await Promise.all([Slide.deleteMany({}), Category.deleteMany({}), Car.deleteMany({})]);
  const out = {};
  const fill = async (Model, rows, key) => {
    if (await Model.estimatedDocumentCount()) return (out[key] = "skipped (not empty)");
    await Model.insertMany(rows);
    out[key] = rows.length;
  };
  await fill(Slide, data.slides.map(({ id, ...s }, i) => ({ ...s, order: i })), "slides");
  await fill(Category, data.categories.map(({ name }, i) => ({ name, order: i })), "categories");
  await fill(Car, data.cars.map(({ id, ...c }, i) => ({ ...c, order: i })), "cars");
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

module.exports = { seed };
