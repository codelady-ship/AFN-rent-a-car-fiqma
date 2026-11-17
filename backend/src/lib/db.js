const mongoose = require("mongoose");

async function connect(uri) {
  if (!uri) throw new Error("MONGODB_URI is not set (see backend/.env.example)");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

// Builds every model's indexes before the server takes requests. Unique indexes
// (e.g. one booking per car and day) are what keeps parallel requests safe.
const ensureIndexes = () => Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

module.exports = { connect, ensureIndexes };
