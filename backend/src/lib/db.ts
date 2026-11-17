import mongoose from "mongoose";

export async function connect(uri: string) {
  if (!uri) throw new Error("MONGODB_URI is not set (see backend/.env.example)");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}
